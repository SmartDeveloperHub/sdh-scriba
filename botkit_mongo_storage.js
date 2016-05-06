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

var db = require('monk');
/**
 * SDH botkit-mongo-storage inspired by
 * botkit-storage-mongo - MongoDB driver for Botkit
 *
 * @param  {Object} config
 * @return {Object}
 */
module.exports = function(config) {

    if (!config || !config.mongoUri) {
        throw new Error('Need to provide mongo address.');
    }

    // Global entities
    var Teams = db(config.mongoUri).get('teams'); //default
    var Owners = db(config.mongoUri).get('owners');
    var Sessions = db(config.mongoUri).get('sessions');

    // Team entities
    var Users = {}; //default
    var Channels = {}; //default
    var OldSessions = {};
    var PendingSessions = {};
    var RunningQSessions = {};
    var CurateSessions = {};
    var RunningASessions = {};
    var FinishedSessions = {};
    Teams.find({}, function(err, tl) {
        if (err) {
            return;
        }
        for (var i = 0; i < tl.length; i++) {
            Users[tl[i].id] = db(config.mongoUri).get('users-' + tl[i].id);
            Channels[tl[i].id] = db(config.mongoUri).get('channels-' + tl[i].id);
            PendingSessions[tl[i].id] = db(config.mongoUri).get('pendingSessions-' + tl[i].id);
            RunningQSessions[tl[i].id] = db(config.mongoUri).get('runningQSessions-' + tl[i].id);
            CurateSessions[tl[i].id] = db(config.mongoUri).get('curateSessions-' + tl[i].id);
            RunningASessions[tl[i].id] = db(config.mongoUri).get('runningASessions-' + tl[i].id);
            FinishedSessions[tl[i].id] = db(config.mongoUri).get('finishedSessions-' + tl[i].id);
        }
    });

    var unwrapFromList = function(cb) {
        return function(err, data) {
            if (err) return cb(err);
            cb(null, data);
        };
    };

    var storage = {
        teams: {
            get: function(id, cb) {
                Teams.findOne({id: id}, unwrapFromList(cb));
            },
            save: function(data, cb) {
                Teams.findAndModify({
                    id: data.id
                }, data, {
                    upsert: true,
                    new: true
                }, function(err, team){
                    if (!Users[team.id]) {
                        Users[team.id] = db(config.mongoUri).get('users-' + team.id);
                    }
                    if (!Channels[team.id]) {
                        Channels[team.id] = db(config.mongoUri).get('channels-' + team.id);
                    }
                    cb()
                });
            },
            all: function(cb) {
                Teams.find({}, cb);
            }
        },
        users: {
            get: function(id, team, cb) {
                if (!Users[team]) {
                    console.log ('error searching <@' + id + '> user in unknown ' + id + ' team');
                    cb('error searching for <@' + id + '> user from unknown ' + id + ' team');
                } else {
                    Users[team].findOne({id: id}, unwrapFromList(cb));
                }
            },
            save: function(data, team, cb) {
                if (!Users[team]) {
                    console.log ('error saving <@' + data.id + '> user from unknown ' + team + ' team');
                    cb('error saving <@' + data.id + '> user from unknown ' + team + ' team');
                } else {
                    Users[team].findAndModify({
                        id: data.id
                    }, data, {
                        upsert: true,
                        new: true
                    }, cb);
                }
            },
            all: function(team, cb) {
                if (!Users[team]) {
                    console.log ('error searching all users from unknown ' + team + ' team');
                    cb('error searching all users from unknown ' + team + ' team');
                } else {
                    Users[team].find({}, cb);
                }
            }
        },
        channels: {
            get: function(id, team, cb) {
                if (!Channels[team]) {
                    console.log ('error searching <#' + id + '> channel in unknown ' + team + ' team');
                    cb('error searching for <@' + id + '> user from unknown ' + id + ' team');
                } else {
                    Channels[team].findOne({id: id}, unwrapFromList(cb));
                }
            },
            save: function(data, team, cb) {
                if (!Channels[team]) {
                    console.log ('error saving <#' + data.id + '> channel from unknown ' + team + ' team');
                    cb('error saving <#' + data.id + '> channel from unknown ' + team + ' team');
                } else {
                    Channels[team].findAndModify({
                        id: data.id
                    }, data, {
                        upsert: true,
                        new: true
                    }, cb);
                }
            },
            all: function(team, cb) {
                if (!Channels[team]) {
                    console.log ('error searching all channels from unknown ' + team + ' team');
                    cb('error searching all channels from unknown ' + team + ' team');
                } else {
                    Channels[team].find({}, cb);
                }
            }
        },
        owners: {
            get: function(id, cb) {
                Owners.findOne({id: id}, unwrapFromList(cb));
            },
            find: function(filter, cb) {
                Owners.find(filter, unwrapFromList(cb));
            },
            save: function(data, cb) {
                Owners.findAndModify({
                    id: data.id
                }, data, {
                    upsert: true,
                    new: true
                }, cb);
            },
            all: function(cb) {
                Owners.find({}, cb);
            }
        },
        pendingSessions: {
            get: function(id, team, cb) {
                if (!PendingSessions[team]) {
                    console.log ('error searching <' + id + '> PendingSession. Unknown ' + team + ' team');
                    cb('error searching for <' + id + '> PendingSession. Unknown ' + team + ' team');
                } else {
                    PendingSessions[team].findOne({id: id}, unwrapFromList(cb));
                }
            },
            save: function(data, team, cb) {
                if (!PendingSessions[team]) {
                    console.log ('error saving <' + id + '> PendingSession. Unknown ' + team + ' team');
                    cb('error saving  <' + id + '> PendingSession. Unknown ' + team + ' team');
                } else {
                    PendingSessions[team].findAndModify({
                        id: data.id
                    }, data, {
                        upsert: true,
                        new: true
                    }, cb);
                }
            },
            all: function(team, cb) {
                if (!PendingSessions[team]) {
                    console.log ('error searching all PendingSessions from unknown ' + team + ' team');
                    cb('error searching all PendingSessions from unknown ' + team + ' team');
                } else {
                    PendingSessions[team].find({}, unwrapFromList(cb));
                }
            }
        },
        runningQSessions: {
            get: function(id, team, cb) {
                if (!RunningQSessions[team]) {
                    console.log ('error searching <' + id + '> RunningQSessions. Unknown ' + team + ' team');
                    cb('error searching for <' + id + '> RunningQSessions. Unknown ' + team + ' team');
                } else {
                    RunningQSessions[team].findOne({id: id}, unwrapFromList(cb));
                }
            },
            save: function(data, team, cb) {
                if (!RunningQSessions[team]) {
                    console.log ('error saving <' + id + '> RunningQSessions. Unknown ' + team + ' team');
                    cb('error saving  <' + id + '> RunningQSessions. Unknown ' + team + ' team');
                } else {
                    RunningQSessions[team].findAndModify({
                        id: data.id
                    }, data, {
                        upsert: true,
                        new: true
                    }, cb);
                }
            },
            all: function(team, cb) {
                if (!RunningQSessions[team]) {
                    console.log ('error searching all RunningQSessions from unknown ' + team + ' team');
                    cb('error searching all RunningQSessions from unknown ' + team + ' team');
                } else {
                    RunningQSessions[team].find({}, unwrapFromList(cb));
                }
            }
        },
        curateSessions: {
            get: function(id, team, cb) {
                if (!CurateSessions[team]) {
                    console.log ('error searching <' + id + '> CurateSessions. Unknown ' + team + ' team');
                    cb('error searching for <' + id + '> CurateSessions. Unknown ' + team + ' team');
                } else {
                    CurateSessions[team].findOne({id: id}, unwrapFromList(cb));
                }
            },
            save: function(data, team, cb) {
                if (!CurateSessions[team]) {
                    console.log ('error saving <' + id + '> CurateSessions. Unknown ' + team + ' team');
                    cb('error saving  <' + id + '> CurateSessions. Unknown ' + team + ' team');
                } else {
                    CurateSessions[team].findAndModify({
                        id: data.id
                    }, data, {
                        upsert: true,
                        new: true
                    }, cb);
                }
            },
            all: function(team, cb) {
                if (!CurateSessions[team]) {
                    console.log ('error searching all CurateSessions from unknown ' + team + ' team');
                    cb('error searching all CurateSessions from unknown ' + team + ' team');
                } else {
                    CurateSessions[team].find({}, unwrapFromList(cb));
                }
            }
        },
        runningASessions: {
            get: function(id, team, cb) {
                if (!RunningASessions[team]) {
                    console.log ('error searching <' + id + '> RunningASessions. Unknown ' + team + ' team');
                    cb('error searching for <' + id + '> RunningASessions. Unknown ' + team + ' team');
                } else {
                    RunningASessions[team].findOne({id: id}, unwrapFromList(cb));
                }
            },
            save: function(data, team, cb) {
                if (!RunningASessions[team]) {
                    console.log ('error saving <' + id + '> RunningASessions. Unknown ' + team + ' team');
                    cb('error saving  <' + id + '> RunningASessions. Unknown ' + team + ' team');
                } else {
                    RunningASessions[team].findAndModify({
                        id: data.id
                    }, data, {
                        upsert: true,
                        new: true
                    }, cb);
                }
            },
            all: function(team, cb) {
                if (!RunningASessions[team]) {
                    console.log ('error searching all RunningASessions from unknown ' + team + ' team');
                    cb('error searching all RunningASessions from unknown ' + team + ' team');
                } else {
                    RunningASessions[team].find({}, unwrapFromList(cb));
                }
            }
        },
        finishedSessions: {
            get: function(id, team, cb) {
                if (!FinishedSessions[team]) {
                    console.log ('error searching <' + id + '> FinishedSessions. Unknown ' + team + ' team');
                    cb('error searching for <' + id + '> FinishedSessions. Unknown ' + team + ' team');
                } else {
                    FinishedSessions[team].findOne({id: id}, unwrapFromList(cb));
                }
            },
            save: function(data, team, cb) {
                if (!FinishedSessions[team]) {
                    console.log ('error saving <' + id + '> FinishedSessions. Unknown ' + team + ' team');
                    cb('error saving  <' + id + '> FinishedSessions. Unknown ' + team + ' team');
                } else {
                    FinishedSessions[team].findAndModify({
                        id: data.id
                    }, data, {
                        upsert: true,
                        new: true
                    }, cb);
                }
            },
            all: function(team, cb) {
                if (!FinishedSessions[team]) {
                    console.log ('error searching all FinishedSessions from unknown ' + team + ' team');
                    cb('error searching all FinishedSessions from unknown ' + team + ' team');
                } else {
                    FinishedSessions[team].find({}, unwrapFromList(cb));
                }
            }
        },
        sessions: {
            get: function(id, cb) {
                Sessions.findOne({session_id: id}, unwrapFromList(cb));
            },
            find: function(filter, cb) {
                Sessions.find(filter, unwrapFromList(cb));
            },
            save: function(data, cb) {
                console.log("mongoStorage... saving session id: " + data.session_id + "; name: " + data.topic.title);
                Sessions.findAndModify({
                    id: data.session_id
                }, data, {
                    upsert: true,
                    new: true
                }, cb);

            },
            all: function(cb) {
                Sessions.find({}, unwrapFromList(cb));
            }
        },
        oldSessions: {
            get: function(id, team, cb) {
                if (!OldSessions[team]) {
                    console.log ('error searching <' + id + '> OldSessions. Unknown ' + team + ' team');
                    cb('error searching for <' + id + '> OldSessions. Unknown ' + team + ' team');
                } else {
                    OldSessions[team].findOne({id: id}, unwrapFromList(cb));
                }
            },
            save: function(data, team, cb) {
                if (!OldSessions[team]) {
                    console.log ('error saving <' + id + '> OldSessions. Unknown ' + team + ' team');
                    cb('error saving  <' + id + '> OldSessions. Unknown ' + team + ' team');
                } else {
                    OldSessions[team].findAndModify({
                        id: data.id
                    }, data, {
                        upsert: true,
                        new: true
                    }, cb);
                }
            },
            all: function(team, cb) {
                if (!OldSessions[team]) {
                    console.log ('error searching all OldSessions from unknown ' + team + ' team');
                    cb('error searching all OldSessions from unknown ' + team + ' team');
                } else {
                    OldSessions[team].find({}, unwrapFromList(cb));
                }
            }
        }
    };

    return storage;
};
