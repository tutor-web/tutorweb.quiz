/* global module, require */
var Promise = require('es6-promise').Promise;

/**
  * Promise-based AJAX API wrapping jQuery
  * Based on: https://gist.github.com/tobiashm/0a987db2f9ec8e5cdbb3
  */
module.exports = function AjaxApi(jqAjax) {
    /** Fetch any URL, expect JSON back */
    this.getJson = function (url) {
        return this.ajax({
            type: 'GET',
            url: url
        }).then(function (data) {
            if (typeof(data) !== 'object') {
                throw new Error('tutorweb::error::Got a ' + typeof(data) + ', not object whilst fetching ' + url);
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
        });
    };

    /** Call $.ajax with given arguments, return promise-wrapped output */
    this.ajax = function (args) {
        return new Promise(function(resolve, reject) {
            jqAjax(args).then(function(data) {
                resolve(data);
            }).fail(function(jqXHR, textStatus, errorThrown) {
                if (jqXHR.responseJSON && jqXHR.responseJSON.error == 'Redirect') {
                    // Redirect error
                    reject(Error('Tutorweb::error::You have not accepted the terms and conditions. Please ' +
                                         '<a href="' + jqXHR.responseJSON.location + '" target="_blank">Click here and click the accept button</a>. ' +
                                         'Reload this page when finished'));
                }

                if (jqXHR.status === 401 || jqXHR.status === 403) {
                    reject(Error("tutorweb::error::Unauthorized to fetch " + args.url));
                }

                if (jqXHR.status === 500 && jqXHR.responseJSON && jqXHR.responseJSON.message) {
                    textStatus = jqXHR.responseJSON.error;
                    errorThrown = jqXHR.responseJSON.message;
                }
                reject(Error("tutorweb::error::" + textStatus + " whilst fetching " + args.url + ": " + errorThrown));
            });
        });
    };
};
