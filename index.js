/*

    #-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=#
      This file is part of the Smart Developer Hub Project:
        http://www.smartdeveloperhub.org/
      Center for Open Middleware
            http://www.centeropenmiddleware.com/
    #-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=#
      Copyright (C) 2015 Center for Open Middleware.
    #-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=#
      Licensed under the Apache License, Version 2.0 (the "License");
      you may not use this file except in compliance with the License.
      You may obtain a copy of the License at
                http://www.apache.org/licenses/LICENSE-2.0
      Unless required by applicable law or agreed to in writing, software
      distributed under the License is distributed on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
      See the License for the specific language governing permissions and
     limitations under the License.
    #-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=#
*/

'use strict';

    try {
        GLOBAL.serverStartDate = new Date();
        //env
        var dotenv = require('dotenv');
        //load environment variables,
        //either from .env files (development),
        dotenv.load();
        // LOGS
        var bunyan = require('bunyan');
        var PrettyStream = require('bunyan-prettystream');
    } catch (err) {
        console.error("Bot Error: " + err);
    }
    /* File Log */
    var prettyStdOut = new PrettyStream();
    prettyStdOut.pipe(process.stdout);
    GLOBAL.log = null;
    GLOBAL.mkdirp = require("mkdirp");
    GLOBAL.getDirName = require("path").dirname;
    mkdirp(getDirName(process.env.FILE_LOG_PATH), function (err) {
        if (err) {
            console.error("! Log file disabled");
            console.error("Error creating log file " +  process.env.FILE_LOG_PATH);
            log.error(err);
        } else {
            GLOBAL.moment = require("moment");
            log = bunyan.createLogger({
                    name: 'SDH-SCRIBA',
                    streams: [{
                        level: process.env.CONSOLE_LOG_LEVEL,
                        stream: prettyStdOut
                    },
                    {
                        level: process.env.FILE_LOG_LEVEL,
                        type: 'rotating-file',
                        path: process.env.FILE_LOG_PATH,
                        period: process.env.FILE_LOG_PERIOD + 'h',   // daily rotation
                        count: parseInt(process.env.FILE_LOG_NFILES)        // keep 3 back copies
                    }]
            });
            init();
        }
    });

    var init = function init () {
        log.info('...starting...');
        // Server
        var bodyParser = require('body-parser');
        var express = require('express');
        var http = require('http');
        var app = express();
        // public folder for images, css,...
        app.use(express.static(__dirname + '/public'));
        app.use(bodyParser.json()); // for parsing application/json
        app.use(bodyParser.urlencoded({ extended: true })); //for parsing url encoded
        // view engine ejs
        app.set('view engine', 'ejs');
        // routes
        require('./routes/routes')(app);
        app.set('port', (process.env.PORT));
        //START ===================================================
        http = http.Server(app);
        http.listen(app.get('port'), function(){
          console.log('listening on port ' + app.get('port'));
        });
    };

