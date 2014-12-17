// Copyright © 2014 Intel Corporation. All rights reserved.
// Use  of this  source  code is  governed by  an Apache v2
// license that can be found in the LICENSE-APACHE-V2 file.

var Path = require("path");

var MkTemp = require("mktemp");
var ShellJS = require("shelljs");

var Config = require("./Config");
var Console = require("./Console");
var Downloader = require("./Downloader");
var FS = require("fs");
var IndexParser = require("./IndexParser");

var BASE_URL = "https://download.01.org/crosswalk/releases/crosswalk/android/";
var CHANNELS = ["beta", "canary", "stable"];



/**
 * Callback signature for {@link AndroidProjectDeps.fetchVersions}
 * @param {String[]} versions Array of available Crosswalk versions sorted oldest - newest
 * @param {String} errormsg Message in case of Error
 * @memberOf AndroidProjectDeps
 * @inner
 */
function fetchVersionsFinishedCb(versions, errormsg) {}



/**
 * Android project dependencies download and lookup.
 * @param {String} channel Crosswalk channel beta/canary/stable
 * @constructor
 */
function AndroidProjectDeps(channel) {

    if (CHANNELS.indexOf(channel) == -1) {
        throw new InvalidChannelError("Unknown channel " + channel);
    }

    this._channel = channel;
}

/**
 * Fetch available Crosswalk versions index.
 * @function fetchVersions
 * @param {Function} callback see {@link AndroidProjectDeps~fetchVersionsFinishedCb}
 * @memberOf AndroidProjectDeps
 */
AndroidProjectDeps.prototype.fetchVersions =
function(callback) {

    var url = BASE_URL + this._channel + "/";
    // TODO use memory stream instead of tmpfile
    var indexFile = MkTemp.createFileSync('index.html.XXXXXX');
    if (indexFile) {

        // Download
        var indicator = Console.createFiniteProgress("Fetching version index ");
        var downloader = new Downloader(url, indexFile);
        downloader.progress = function(progress) {
            indicator.update(progress);
        };
        downloader.get(function(errormsg) {

            indicator.done("");

            if (errormsg) {

                callback(null, errormsg);

            } else {

                // Parse
                var buffer = FS.readFileSync(indexFile, {"encoding": "utf8"});
                var parser = new IndexParser(buffer);
                var versions = parser.parse();
                callback(versions);
            }

            ShellJS.rm(indexFile);
        });
    } else {

        callback(null, "Failed to download package index.");
        ShellJS.rm(indexFile);
        return;
    }
};

/**
 * Locate Crosswalk distribution zip.
 * @function find
 * @returns {String} Relative path to zip file
 * @memberOf AndroidProjectDeps
 */
AndroidProjectDeps.prototype.find =
function() {

    var zips = ShellJS.ls('crosswalk-*.*.*.*.zip');
    if (zips.length === 0) {
        // Also try parent dir.
        // This is especially useful for tests that run in a temporary dir.
        zips = ShellJS.ls('../crosswalk-*.*.*.*.zip');
        if (zips.length === 0) {
            Console.error("Crosswalk Zip not found in current or parent directory " + ShellJS.pwd());
            return false;
        }
    }

    var zipFile = zips[zips.length - 1];

    return zipFile;
};

/**
 * Download crosswalk zip.
 * @function downnload
 * @param {String} version Crosswalk version string
 * @param {String} dir Directory to download to
 * @param {Function} callback Callback function.
 * @memberOf AndroidProjectDeps
 */
AndroidProjectDeps.prototype.download =
function(version, dir, callback) {

    var filename = "crosswalk-" + version + ".zip";
    var url = BASE_URL +
              this._channel + "/" +
              version + "/" +
              filename;

    // Download
    // At the moment we unconditionally download, overwriting the existing copy.
    var indicator = Console.createFiniteProgress("Downloading " + version + " ");
    var path = Path.join(dir, filename);
    var downloader = new Downloader(url, path);
    downloader.progress = function(progress) {
        indicator.update(progress);
    };
    downloader.get(function(errormsg) {

        indicator.done("");

        if (errormsg) {

            callback(null, errormsg);

        } else {

            callback(filename);
        }
    });
};



/**
 * Creates a new InvalidChannelError.
 * @extends Error
 * @param {String} message Error message.
 * @constructor
 * @memberOf AndroidProjectDeps
 * @inner
 */
function InvalidChannelError(message) {
    Error.call(this, message);
}
InvalidChannelError.prototype = Error.prototype;

AndroidProjectDeps.InvalidChannelError = InvalidChannelError;



module.exports = AndroidProjectDeps;