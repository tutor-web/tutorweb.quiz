#!/usr/bin/env nodejs
var fs = require('fs');

try {
    var reporter = require('nodeunit').reporters.default;
}
catch(e) {
    console.log("Cannot find nodeunit module. Download via:");
    console.log("");
    console.log("    git clone git://github.com/caolan/nodeunit.git node_modules/nodeunit");
    console.log("");
    process.exit();
}

process.chdir('tests');
reporter.run(fs.readdirSync('.').filter(function (str) {
    return str.indexOf('.js', str.length - 3) !== -1;
}));
