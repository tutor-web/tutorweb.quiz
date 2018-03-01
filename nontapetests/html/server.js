var exec = require('child_process').exec;
var static = require('node-static');
var sys = require('sys');

//
// Create a node-static server instance to serve the 'tests/html' folder
//
var file = new static.Server('./tests/html');

require('http').createServer(function (request, response) {
    request.addListener('end', function () {
        console.log(" " + request.url);
        if (request.url === "/quiz/tw.js") {
            exec("make www/tw.js", function (error, stdout, stderr) {
                sys.puts(stdout);
                file.serve(request, response);
            });
        } else {
            file.serve(request, response);
        }
    }).resume();
}).listen(8000);
