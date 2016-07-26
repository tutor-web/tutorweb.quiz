/*jslint nomen: true, plusplus: true, browser:true, todo:true */
/*global module, require, window, Promise */
require('es6-promise').polyfill();

/**
  * Promise-based AJAX API wrapping jQuery
  * Based on: https://gist.github.com/tobiashm/0a987db2f9ec8e5cdbb3
  */
module.exports = function AjaxApi(jqAjax) {
    "use strict";

    /** Fetch any URL, expect HTML back */
    this.getHtml = function (url, extras) {
        return this.ajax({
            type: 'GET',
            datatype: 'html',
            url: url
        }, extras);
    };

    /** Fetch any URL, expect JSON back */
    this.getJson = function (url, extras) {
        return this.ajax({
            type: 'GET',
            url: url
        }, extras).then(function (data) {
            if (typeof data !== 'object') {
                throw new Error('tutorweb::error::Got a ' + typeof data + ', not object whilst fetching ' + url);
            }
            return data;
        });
    };

    /** Post data, encoded as JSON, to url */
    this.postJson = function (url, data, extras) {
        return this.ajax({
            data: JSON.stringify(data),
            contentType: 'application/json',
            type: 'POST',
            url: url
        }, extras).then(function (data) {
            if (typeof data !== 'object') {
                throw new Error('tutorweb::error::Got a ' + typeof data + ', not object whilst fetching ' + url);
            }
            return data;
        });
    };

    /** Call $.ajax with combined arguments, return promise-wrapped output */
    this.ajax = function (ajax_opts, extra_opts) {
        var args = {
            timeout: 5000,
        };
        Object.keys(ajax_opts || {}).map(function (k) { args[k] = ajax_opts[k]; });
        Object.keys(extra_opts || {}).map(function (k) { args[k] = extra_opts[k]; });

        return new Promise(function (resolve, reject) {
            if (window.navigator && !window.navigator.onLine) {
                reject(new Error("tutorweb::neterror::Currently offline"));
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
                    reject(new Error('tutorweb::updatedetails::You have not accepted the terms and conditions.'));
                }

                if (jqXHR.status === 401 || jqXHR.status === 403) {
                    // Unauth / wrong user
                    reject(new Error("tutorweb::unauth::" + textStatus + ". Please " +
                                     '<a href="' + '//' + window.document.location.host + '/login' +
                                     '?came_from=' + encodeURIComponent(window.document.location) +
                                     (/user \w+$/i.test(textStatus) ? '&login_name=' + textStatus.match(/for user (\w+)/i)[1] : '') +
                                     '">click here to log-in</a> before continuing.::html'));
                }

                if (textStatus === 'timeout') {
                    reject(new Error("tutorweb::neterror::Timeout whilst fetching " + args.url));
                }

                if (!errorThrown && jqXHR.status === 0 && textStatus === 'error') {
                    // Network error / request cancelled
                    reject(new Error("tutorweb::neterror::Failed to fetch " + args.url));
                }

                reject(new Error("tutorweb::error::" + errorThrown + " whilst fetching " + args.url + ": " + textStatus));
            });
        });
    };
};
