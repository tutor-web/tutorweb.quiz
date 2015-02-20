/*jslint nomen: true, plusplus: true, browser:true */
/*global module, require, window */
var Promise = require('es6-promise').Promise;

/**
  * Promise-based AJAX API wrapping jQuery
  * Based on: https://gist.github.com/tobiashm/0a987db2f9ec8e5cdbb3
  */
module.exports = function AjaxApi(jqAjax) {
    "use strict";

    /** Fetch any URL, expect HTML back */
    this.getHtml = function (url) {
        return this.ajax({
            type: 'GET',
            datatype: 'html',
            url: url
        });
    };

    /** Fetch any URL, expect JSON back */
    this.getJson = function (url) {
        return this.ajax({
            type: 'GET',
            url: url
        }).then(function (data) {
            if (typeof data !== 'object') {
                throw new Error('tutorweb::error::Got a ' + typeof data + ', not object whilst fetching ' + url);
            }
            return data;
        });
    };

    /** Post data, encoded as JSON, to url */
    this.postJson = function (url, data) {
        return this.ajax({
            data: JSON.stringify(data),
            contentType: 'application/json',
            type: 'POST',
            url: url
        }).then(function (data) {
            if (typeof data !== 'object') {
                throw new Error('tutorweb::error::Got a ' + typeof data + ', not object whilst fetching ' + url);
            }
            return data;
        });
    };

    /** Call $.ajax with given arguments, return promise-wrapped output */
    this.ajax = function (args) {
        return new Promise(function (resolve, reject) {
            if (window.navigator && !window.navigator.onLine) {
                reject(new Error("tutorweb::error::Currently offline"));
            }

            jqAjax(args).then(function (data) {
                resolve(data);
            }).fail(function (jqXHR, textStatus, errorThrown) {
                if (jqXHR.responseJSON && jqXHR.responseJSON.error) {
                    // Response was JSON, so use what's inside
                    errorThrown = jqXHR.responseJSON.error;
                    textStatus = jqXHR.responseJSON.message;
                }

                if (errorThrown === 'Redirect') {
                    // Redirect error
                    reject(new Error('tutorweb::error::You have not accepted the terms and conditions. Please ' +
                                     '<a href="' + jqXHR.responseJSON.location + '" target="_blank">Go here and check "Accept terms of use"</a>::html'));
                }

                if (jqXHR.status === 401 || jqXHR.status === 403) {
                    // Unauth / wrong user
                    reject(new Error("tutorweb::error::" + textStatus + ". Please " +
                                     '<a href="' + '//' + window.document.location.host + '/login' +
                                     '?came_from=' + encodeURIComponent(window.document.location) +
                                     (/user \w+$/i.test(textStatus) ? '&login_name=' + textStatus.match(/for user (\w+)/i)[1] : '') +
                                     '">click here to log-in</a> before continuing.::html'));
                }

                if (!errorThrown && textStatus === 'error') {
                    // Say something slightly more useful
                    errorThrown = "Failed";
                    textStatus = "";
                }

                reject(new Error("tutorweb::error::" + errorThrown + " whilst fetching " + args.url + ": " + textStatus));
            });
        });
    };
};
