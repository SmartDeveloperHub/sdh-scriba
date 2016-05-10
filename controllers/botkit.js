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

// **********************************
// this code is inspired by npm botkit-express-demo 0.1.0 (MIT)
var Botkit = require('botkit');
var uuid = require('node-uuid');
// Events
var events = require('events');
var eventEmitter = new events.EventEmitter();
// Mongo DB
var mongoUri = process.env.MONGOLAB_URI || 'mongodb://localhost/scriba_default';
var botkit_mongo_storage = require('../botkit_mongo_storage')({mongoUri: mongoUri});

// Events
var events = require('events');
var eventEmitter = new events.EventEmitter();

if (!process.env.SLACK_ID || !process.env.SLACK_SECRET || !process.env.PORT) {
  console.log('Error: SLACK_ID SLACK_SECRET and PORT not found in environment');
  process.exit(1);
}

var controller = Botkit.slackbot({
    storage: botkit_mongo_storage
})

exports.controller = controller;

//CONNECTION FUNCTIONS=====================================================
exports.connect = function(team_config) {
    var bot = controller.spawn(team_config);
    controller.trigger('create_bot', [bot, team_config]);
}

// just a simple way to make sure we don't
// connect to the RTM twice for the same team
var _bots = {};

function trackBot(bot, team, cb) {
    bot.api.users.info({user: bot.identity.id}, function (err, res) {
        if (err) {
            log.error(err);
            return;
        }
        bot.slack_user = res.user;
        bot.api.users.info({user: team.createdBy}, function (err, res) {
            if (err) {
                log.error(err);
                return;
            } else {
                bot.owner = res.user;
                _bots[bot.config.token] = bot;
                cb();
            }
        });

    });

}
controller.on('create_bot',function(bot,team) {

    if (_bots[bot.config.token]) {
        // already online! do nothing.
        console.log("already online! do nothing.")
    }
    else {
        var cbtrack = function () {
            controller.saveTeam(team, function (err, id) {
                if (err) {
                    console.log("Error saving team")
                }
                else {
                    console.log("Team " + team.name + " saved");
                    newOwner(bot, team);
                }
            })
        };
        bot.startRTM(function (err) {

            if (!err) {
                console.log("RTM ok")
                trackBot(bot, team, cbtrack);
            }
            else {
                console.log("RTM failed")
            }
        });
    }
});


var newOwner = function(bot,team) {
    controller.storage.users.get(team.createdBy, team.id, function (err, user) {
        if (!user || user.name == undefined) {
            bot.api.users.info({user: team.createdBy}, function (err, res) {
                if (err) {
                    log.error(err);
                    return;
                } else  {
                    controller.storage.owners.get(team.createdBy, function (err, user) {
                        if (err) {
                            log.error(err);
                            return;
                        }
                        // Complete user information
                        var Nuser = res.user;
                        Nuser.isRoot = true;
                        Nuser.access_token = user.access_token;
                        Nuser.scopes = user.scopes;
                        controller.storage.users.save(Nuser, team.id, function (err, user) {
                            console.log('First Admin -> @' + Nuser.name);
                        });
                    });
                }
            });
        } else {
            user.isRoot = true;
            controller.storage.users.save(user, team.id, function (err, user) {
                console.log('First Admin -> @' + user.name);
            });
        }
    });
    bot.startPrivateConversation({user: team.createdBy},function(err, convo) {
        if (err) {
            console.log(err);
        } else {
            convo.say('Hi!. My name is *Scriba Bot*.');
            convo.say('You are *my admin* now. say `help` to know what can I do.');
        }
    });
};

//REACTIONS TO EVENTS==========================================================

// Handle events related to the websocket connection to Slack
controller.on('rtm_open',function(bot) {
    console.log('** The RTM api just connected!');
});

controller.on('rtm_close',function(bot) {
    console.log('** The RTM api just closed');
    // you may want to attempt to re-open
});

//DIALOG ======================================================================

controller.storage.teams.all(function(err,teams) {
    if (err) {
        throw new Error(err);
    }
    // connect all teams with bots up to slack!
    for (var t  in teams) {
        if (teams[t].bot) {
            var bot = controller.spawn(teams[t]).startRTM(function(err) {
                if (err) {
                    console.log('Error connecting bot to Slack:',err);
                } else {
                    trackBot(bot, teams[t], function() {
                        console.log("bot tracked OK");
                    });
                }
            });
        }
    }
});

/* Aux */
    var isAdmin = function isAdmin(uid, team, cb) {
        controller.storage.users.get(uid, team, function(err,user) {
            if (err) {
                console.log("error getting user info: " + uid);
                cb(false, user);
            }
            if(!user) {
                console.log("user not found " + uid);
                cb(false, user);
            } else {
                cb(user['isRoot'] == true, user);
            }
        });
    };
    function formatUptime(uptime) {
        var unit = 'second';
        if (uptime > 60) {
            uptime = uptime / 60;
            unit = 'minute';
        }
        if (uptime > 60) {
            uptime = uptime / 60;
            unit = 'hour';
        }
        if (uptime != 1) {
            unit = unit + 's';
        }

        uptime = uptime + ' ' + unit;
        return uptime;
    }

    var getQuestionsMarkdown = function getQuestionsMarkdown(questions) {

        var t = questions.map(function (e, index) {
            return {
                "title": index + 1,
                "value": e.question,
                "short": true
            };
        });
        if (t.length > 100) {
            t.slice(0, 99);
        }
        var mdUser = {
            "fallback": "Your Questions:",
            //"pretext": "Optional text that appears above the attachment block",

            "author_name": "SDH BOT",
            "author_icon": "https://sdh.conwet.fi.upm.es/assets/images/sdh_400ppp_RGB_imagotipo_small.png",

            "fields": t
        };
        return [mdUser];
    };

/*controller.on('direct_message', function (bot, message) {
    console.log(message.text);
});*/
// reply to a direct message
/*controller.on('direct_message', function (bot, message) {
        if (message.text[0] !== '"' && message.text[message.text.length - 1] !== '"') {
            return;
        }
        bot.startConversation(message, function (err, convo) {
            convo.ask('Do you want to save this question?', [
                {
                    pattern: bot.utterances.yes,
                    callback: function (response, convo) {
                        dbManager.addQuestion(message, function() {
                            convo.say('Saved!');
                            convo.say('Thanks!');
                            convo.next();
                        });
                    }
                },
                {
                    pattern: bot.utterances.no,
                    callback: function (response, convo) {
                        convo.say("No problem, I've already forgotten");
                        convo.next();
                    }
                },
                {
                    default: true,
                    callback: function (response, convo) {
                        convo.say("What?");
                        convo.repeat();
                        convo.next();
                    }
                },
            ]);
        });
    });
*/
/*controller.hears(['remove', 'destroy'], 'direct_message', function (bot, message) {
        if (message.user == 'USLACKBOT') {
            return;
        }
        dbManager.findUserQuestions(message.user, function (result) {
            startQuestions(result);
        });
        var startQuestions = function startQuestions(userMsgs) {
            var attach = getQuestionsMarkdown(userMsgs);
            bot.reply(message, {
                "attachments": attach
            });
            bot.startConversation(message, function (err, convo) {
                convo.ask('please, tell me the NUMBER of the question you want remove, ALL or ANY', [
                    {
                        pattern: /^(all)/,
                        callback: function (response, convo) {
                            bot.startConversation(message, function (err, convo2) {
                                convo2.ask('Are you sure to remove ALL your questions?', [
                                    {
                                        pattern: bot.utterances.yes,
                                        callback: function (response, convo) {
                                            dbManager.deleteAllUserQuestion(message.user, function (result) {
                                                convo.say("...deleting all your questions");
                                                convo.next();
                                            });
                                        }
                                    },
                                    {
                                        pattern: bot.utterances.no,
                                        callback: function (response, convo) {
                                            convo.say("No one question has been removed");
                                            convo.next();
                                        }
                                    },
                                    {
                                        default: true,
                                        callback: function (response, convo) {
                                            convo.say("No one question has been removed");
                                            convo.next();
                                        }
                                    },
                                ]);

                            });
                            convo.next();
                        }
                    },
                    {
                        pattern: /^(any|none)/,
                        callback: function (response, convo) {
                            convo.say("No one question has been removed");
                            convo.next();
                        }
                    },
                    {
                        // 0 - 99
                        pattern: /^[1-9]/,
                        callback: function (response, convo) {
                            if (response.text === ("" + parseInt(response.text, 10))) {
                                var um = userMsgs[parseInt(response.text, 10) - 1];
                                if (!um) {
                                    convo.say('This number does not correspond to any of your questions: ' + response.text);
                                    convo.say("No one question has been removed");
                                    convo.next();
                                }else {
                                    convo.say('...removing "' + um.question + '"');
                                    dbManager.deleteQuestion(um.id, function() {
                                        convo.next();
                                    })
                                }

                            }
                        }
                    },
                    {
                        default: true,
                        callback: function (response, convo) {
                            convo.say("What?");
                            // just repeat the question
                            convo.repeat();
                            convo.next();
                        }
                    }
                ]);
            });
        };

    });*/

    var getUsersFiltered = function getUsersFiltered(bot, attrib, value, cb) {
        var team = bot.team_info.id;
        controller.storage.users.all(team, function(err,users) {
            if (err) {
                console.log("error getting users info for the team: " + team);
                cb(false, []);
            }
            if(!users) {
                console.log("Team users not found!  " + team);
                cb(false, []);
            } else {
                var au = [];
                for(var i = 0; i < users.length; i++) {
                    if(users[i][attrib] == value) {
                        au.push(users[i]);
                    }
                }
                cb(au);
            }
        });
    };

    var getUsersByRole = function getUsersByRole(bot, callback) {
        getUsersFiltered(bot, 'isRoot', true, function(admins) {
            getUsersFiltered(bot, 'isResponder', true, function (questioners) {
                getUsersFiltered(bot, 'isQuestioner', true, function (responders) {
                    callback(admins, questioners, responders)
                });
            });
        });
    };

    var getAllSessions = function getAllSessions(bot, cb) {
        var team = bot.team_info.id;
        controller.storage.pendingSessions.all(team, function(err, pendingSessions) {
            controller.storage.runningQSessions.all(team, function(err, runningQSessions) {
                controller.storage.curateSessions.all(team, function(err, curateSessions) {
                    controller.storage.runningASessions.all(team, function(err, runningASessions) {
                        controller.storage.finishedSessions.all(team, function(err, finishedSessions) {
                            cb(pendingSessions, runningQSessions, curateSessions, runningASessions, finishedSessions);
                        });
                    });
                });
            });
        });
    };

    var getBotStatus = function getBotStatus(bot, statuscb) {
        getUsersByRole(bot, function(admins, questioners, responders) {
            statuscb({
                id: bot.identity.id,
                avatar: bot.slack_user.profile.image_24,
                team: {id: bot.team_info.id, name: bot.team_info.name},
                created: bot.identity.created,
                name: bot.identity.name,
                messagecount: bot.msgcount,
                admins: admins,
                questioners: questioners,
                responders: responders,
                allSession: allSessions
            });
            /*getAllSessions(bot, function (pendingSessions, runningQSessions, curateSessions, runningASessions, finishedSessions) {
                statuscb({
                    id: bot.identity.id,
                    avatar: bot.slack_user.profile.image_24,
                    team: {id: bot.team_info.id, name: bot.team_info.name},
                    created: bot.identity.created,
                    name: bot.identity.name,
                    messagecount: bot.msgcount,
                    admins: admins,
                    questioners: questioners,
                    responders: responders,
                    pendingSessions: pendingSessions,
                    runningQSessions: pendingSessions,
                    curateSessions: curateSessions,
                    runningASessions: runningASessions,
                    finishedSessions: finishedSessions
                });
            });*/
        });
    };

    var getBotStatusMarkdown = function getBotStatusMarkdown(bot, cb) {
        getBotStatus(bot, function (status) {
            var theCreat = moment(status.created * 1000);
            var md = {
                //"text": "Status information for admins",
                "attachments": [
                    {
                        "mrkdwn_in": ["text", "fields", 'fallback'],
                        "fallback": "This attachment show @" + status.name + " bot basic statistics and other relevant information",
                        "color": "#36a64f",
                        "author_name": status.name,
                        "author_icon": status.avatar,
                        "text": "Bot for *" + status.team.name + "* Slack Team" + "\n>>>Installed " + theCreat.fromNow() + " (" + theCreat.format('DD/MM/YYYY') + ")",
                        "fields": [
                            {
                                "title": "Total Messages received",
                                "value": ">>>" + status.messagecount,
                                "short": true
                            },
                            {
                                "title": "Total Admins",
                                "value": ">>>" + status.admins.length,
                                "short": true
                            },
                            {
                                "title": "Total Questioners",
                                "value": ">>>" + status.questioners.length,
                                "short": true
                            },
                            {
                                "title": "Total Responders",
                                "value": ">>>" + status.responders.length,
                                "short": true
                            },
                            {
                                "title": "Active PendingSessions",
                                "value": ">>>" + status.allSession.length,
                                "short": true
                            }
                        ]
                    }
                ]
            }
            cb(md);
        });
    };

    /* Help fields */
    var globalHelp = [
        {
            "title": "Scriba Bot help",
            "value": ">>>" + 'say `help`',
            "short": true
        }
    ];
    var adminHelp = [
        {
            "title": "Add new Admin. Admins can create and set up feedback sessions",
            "value": ">>>" + '`add organizer @userid`',
            "short": true
        },
        {
            "title": 'Remove admin',
            "value": ">>>" + '`rm admin @userid`',
            "short": true
        },
        {
            "title": "Create new Question-Answers Session",
            "value": ">>>" + '`create session <session name>`',
            "short": true
        },
        {
            "title": "See all Sessions",
            "value": ">>>" + "`sessions`",
            "short": true
        },
        {
            "title": "Select a session to set up",
            "value": ">>>" + '`setup session <session id>`',
            "short": true
        },
    ];
    // Admin helps
    var adminBootstrapHelp = [
        {
            "title": "Change session title",
            "value": ">>>" + "`set Title`",
            "short": true
        },
        {
            "title": "Change session purpose",
            "value": ">>>" + "`set Purpose`",
            "short": true
        },
        {
            "title": "Add Question Providers for this session",
            "value": ">>>" + "`add QP [@uid]`",
            "short": true
        },
        {
            "title": "Set corpus formation period, (date format <dd-mm-yyyy MM:HH> or other ISO_8601)",
            "value": ">>>" + "`set corpus from 23-05-2016 10:00 to 27-05-2016 15:00`",
            "short": true
        },
        {
            "title": "Add Feedback Providers for this session",
            "value": ">>>" + "`add FP [@uid]`",
            "short": true
        },
        {
            "title": "Set feedback period, (date format <dd-mm-yyyy MM:HH> or other ISO_8601)",
            "value": ">>>" + "`set feedback from 23-05-2016 10:00 to 27-05-2016 15:00`",
            "short": true
        }
    ];
    var adminCorpusHelp = [
        {
            "title": "Add Feedback Providers for this session",
            "value": ">>>" + "`add FP [@uid]`",
            "short": true
        },
        {
            "title": "Set feedback period, (date format <dd-mm-yyyy MM:HH> or other ISO_8601)",
            "value": ">>>" + "`set feedback from 23-05-2016 10:00 to 27-05-2016 15:00`",
            "short": true
        },
        {
            "title": "Show current corpus questions status",
            "value": ">>>" + "`corpus status`",
            "short": true
        }
    ];
    var adminCurateHelp = [
        {
            "title": "Add Feedback Providers for this session",
            "value": ">>>" + "`add FP [@uid]`",
            "short": true
        },
        {
            "title": "Set feedback period, (date format <dd-mm-yyyy MM:HH> or other ISO_8601)",
            "value": ">>>" + "`set feedback from 23-05-2016 10:00 to 27-05-2016 15:00`",
            "short": true
        },
        {
            "title": "Show corpus questions",
            "value": ">>>" + "`corpus status`",
            "short": true
        }
    ];
    var adminFeedbackHelp = [
        {
            "title": "Show corpus questions",
            "value": ">>>" + "`corpus status`",
            "short": true
        },
        {
            "title": "Show current feedback status",
            "value": ">>>" + "`feedback status`",
            "short": true
        }
    ];
    var adminFinishedHelp = [
        {
            "title": "Show corpus questions",
            "value": ">>>" + "`corpus status`",
            "short": true
        },
        {
            "title": "Show feedback status",
            "value": ">>>" + "`feedback status`",
            "short": true
        },
        {
            "title": "Session Result",
            "value": ">>>" + "`session results`",
            "short": true
        }
    ];
    // User help
    var userCorpusHelp = [
        {
            "title": 'Show your questions',
            "value": ">>>" + '`my questions`',
            "short": true
        },
        {
            "title": 'Add new question in session corpus',
            "value": ">>>" + 'Write your questions in quotes (e.g `add question "Give me SDH information"`)',
            "short": true
        },
        {
            "title": 'Remove one of your question',
            "value": ">>>" + '`remove Question <QID>`',
            "short": true
        }
    ];
    var userCurateHelp = [];
    var userFeedbackHelp = [
        {
            "title": "Start answering questions",
            "value": ">>>" + "`ready`",
            "short": true
        },
        {
            "title": "Show feedback session status",
            "value": ">>>" + "`status`",
            "short": true
        }
    ];
    var userFinishedHelp = [];
    var sendUserHelp = function sendUserHelp (bot, message) {
        // user info
        controller.storage.users.get(message.user, message.team, function(err, user) {
            if (err) {
                console.log("error getting user info: " + message.user);
                //replyUserHelp(bot, message, globalHelp, null);
                bot.reply(message, "Hi <@" + message.user + ">, by the moment I haven't any session for you. When a session is started I will notify you personally");
            }
            if (!user) {
                console.log("user not found " + message.user);
                //replyUserHelp(bot, message, globalHelp, null);
                bot.reply(message, "Hi <@" + message.user + ">, by the moment I haven't any session for you. When a session is started I will notify you personally");
            } else {
                // activeSession: the session, the last interaction and timer or undefined
                var activeSession = userStatus[message.user];
                if (!activeSession) {
                    // Regular Help
                    if (user.isRoot) {
                        // Admin or Organizer.
                        replyUserHelp(bot, message, null, adminHelp);
                    } else {
                        replyUserHelp(bot, message, userHelp, null);
                    }
                } else {
                    // This user has an active session!
                    var sessionMoment = getSessionMoment(activeSession.session);
                    var uh = globalHelp;
                    var ah = adminHelp;
                    switch(sessionMoment) {
                        case "boot":
                            console.log('help for boot creation session (Only admins)');
                            // Only Orgaizers and admins can ask for help in this session step
                            ah = ah.concat(adminBootstrapHelp);
                            break;
                        case "corpus":
                            console.log('help for corpus creation session');
                            uh = uh.concat(userCorpusHelp);
                            ah = ah.concat(adminCorpusHelp);
                            break;
                        case "curate":
                            console.log('help for curate session');
                            uh = uh.concat(userCurateHelp);
                            ah = ah.concat(adminCurateHelp);
                            break;
                        case "feedback":
                            console.log('help for feedback session');
                            uh = uh.concat(userFeedbackHelp);
                            ah = ah.concat(adminFeedbackHelp);
                            break;
                        case "finished":
                            console.log('help for finished session');
                            uh = uh.concat(userFinishedHelp);
                            ah = ah.concat(adminFinishedHelp);
                            break;
                    }
                    if (user.isRoot) {
                        // Admin or Organizer.
                        replyUserHelp(bot, message, uh, ah);
                    } else {
                        replyUserHelp(bot, message, uh, null);
                    }
                }
            }
        });
    };

    var replyUserHelp = function replyUserHelp (bot, message, ufields, rfields) {

        var attach = [];
        // Organizator help
        if (rfields) {
            attach.push({
                "fallback": "Organizator Help",
                "color": "#F00",
                "author_name": "Scriba Help",
                "author_icon": "https://sdh.conwet.fi.upm.es/assets/images/sdh_400ppp_RGB_imagotipo_small.png",
                "mrkdwn_in": ["fields", "fallback"],
                "fields": rfields
            });
        };
        // Regular user help
        if (ufields) {
            attach.push({
                "fallback": "Help",
                "color": "#008000",
                "author_name": "Scriba Help",
                "author_icon": "https://sdh.conwet.fi.upm.es/assets/images/sdh_400ppp_RGB_imagotipo_small.png",
                "mrkdwn_in": ["fields", "fallback"],
                "fields": ufields
            });
        };

        bot.reply(message, {
            "attachments": attach
        });
    };

    var getSessionMoment = function getSessionMoment(session) {
        var now = moment();
        var cfFrom = moment(session.CFPeriod.from);
        var cfTo = moment(session.CFPeriod.to);
        var fgFrom = moment(session.FGPeriod.from);
        var fgTo = moment(session.FGPeriod.to);

        if (session.CFPeriod.from == null && session.CFPeriod.to == null ||
            now < cfFrom) {
            return "boot";
        } else if (now > cfFrom && now < cfTo) {
            return "corpus";
        } else if (session.FGPeriod.from == null && session.FGPeriod.to == null ||
                   now < fgFrom) {
            return "curate";
        } else if (now > fgFrom && now < fgTo) {
            return "feedback";
        } else if (now > fgTo) {
            return "finished";
        }
    };
                {
                    "fallback": "Help",
                    "author_name": "Scriba Help",
                    "author_icon": "https://sdh.conwet.fi.upm.es/assets/images/sdh_400ppp_RGB_imagotipo_small.png",
                    "mrkdwn_in": ["fields", "fallback"],
                    "fields": t
                }
            ];
            bot.reply(message, {
                "attachments": attach
            });
        };
    });
    controller.hears(['status'], 'direct_message,direct_mention', function (bot, message) {
        isAdmin(message.user, message.team, function(isRoot, user) {
            if(!isRoot) {
                return;
            } else {
                if (!user) {
                    console.log('Weird error. Unknown user... but organizer???? no way.')
                } else {
                    getBotStatusMarkdown(bot, function(formatedMsg) {
                        bot.reply(message, formatedMsg);
                    });
                }
            }
        });
    });
    controller.hears(['hello', 'hi'], 'direct_message', function (bot, message) {

        bot.api.reactions.add({
            timestamp: message.ts,
            channel: message.channel,
            name: 'robot_face',
        }, function (err, res) {
            if (err) {
                bot.botkit.log('Failed to add emoji reaction :(', err);
            }
        });

        controller.storage.users.get(message.user, message.team, function (err, user) {
            if (user && user.name) {
                bot.reply(message, 'Hello ' + user.name + '! say "help" to see what I can do');
            } else {
                bot.api.users.info({user: message.user}, function (err, res) {
                    if (err) {
                        log.error(err);
                        return;
                    }
                    bot.reply(message, 'Hello ' + res.user.name + '! say "help" to see what I can do');
                });
            }
        });
    });
    controller.hears(['call me (.*)'], 'direct_message', function (bot, message) {
        var matches = message.text.match(/call me (.*)/i);
        var name = matches[1];
        controller.storage.users.get(message.user, message.team, function (err, user) {
            if (!user) {
                user = {
                    id: message.user,
                };
            }
            user.name = name;
            controller.storage.users.save(user, message.team, function (err, id) {
                bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
            });
        });
    });
    controller.hears(['what is my name', 'who am i'], 'direct_message', function (bot, message) {

        controller.storage.users.get(message.user, message.team, message.team, function (err, user) {
            if (user && user.name) {
                bot.reply(message, 'Your name is ' + user.name);
            } else {
                bot.reply(message, 'I don\'t know yet!');
            }
        });
    });
    controller.hears(['uptime', 'identify yourself', 'who are you', 'what is your name'], 'direct_message', function (bot, message) {

        var hostname = os.hostname();
        var uptime = formatUptime(process.uptime());

        bot.reply(message, ':robot_face: I am a bot named <@' + bot.identity.name + '>. I have been running for ' + uptime + ' on ' + hostname + '.');

    });

/* ADD/REMOVE organizers */
    controller.hears(['add organizer <@(.*)>'], 'direct_message', function (bot, message) {
        var a1 = function(user) {
            if(user.isRoot) {
                bot.reply(message, '@' + user.name + ' is already organizer.');
                return;
            }
            user.isRoot = true;
            controller.storage.users.save(user, message.team, function (err, user) {
                console.log('New organizer -> ' + user);
                bot.reply(message, 'New organizer: <@' + user.id + ">");
                // New organizer notification
                bot.startPrivateConversation({user: user.id},function(err,convo) {
                    if (err) {
                        console.log(err);
                    } else {
                        convo.say('Hi!. My name is Scriba Bot.\nYou are my *organizer* now. say `help` to know what can I do.');
                    }
                });
            });
        };
        isAdmin(message.user, message.team, function(isRoot, admin) {
            if(!isRoot) {
                // Notify that need to be oranizator or admin
                controller.storage.owners.find({team_id: message.team}, function (err, ownerUser) {
                    if (err) {
                        console.log('error getting owner');
                    } else {
                        console.log("bot owner: <@" + ownerUser[0].id + ">");
                        bot.reply(message, {
                            "text": "Only organizers can add new organizer! talk with <@" + ownerUser[0].id + ">"
                        });
                    }
                });
                return;
            } else {
                var uid = message.match[1];
                controller.storage.users.get(uid, message.team, function (err, user) {
                    if (!user) {
                        bot.api.users.info({user: uid}, function (err, res) {
                            if (err) {
                                log.error(err);
                                return;
                            }
                            a1(res.user);
                        });
                    } else {
                        a1(user);
                    }
                });
            }
        });
    });
    controller.hears(['rm organizer <@(.*)>'], 'direct_message', function (bot, message) {
        var a1 = function(user) {
            if(!user.isRoot) {
                bot.reply(message, 'sorry, @' + user.name + ' is not admin.');
                return;
            }
            user.isRoot = false;
            controller.storage.users.save(user, function (err, id) {
                console.log('Removing @' + user.name + 'from admin group');
                bot.reply(message, 'Removing @' + user.name + 'from admin group');
            });
        };
        isAdmin(message.user, message.team, function(isRoot, user) {
            if(!isRoot) {
                // Notify that need to be organizer or admin
                controller.storage.owners.find({team_id: message.team}, function (err, ownerUser) {
                    if (err) {
                        console.log('error getting owner');
                    } else {
                        console.log("bot owner: <@" + ownerUser[0].id + ">");
                        bot.reply(message, {
                            "text": "Only Admins can remove admins! talk with <@" + ownerUser[0].id + ">"
                        });
                    }
                });
                return;
            } else {
                var uid = message.match[1];
                controller.storage.users.get(uid, message.team, function (err, user) {
                    if (!user) {
                          bot.api.users.info({user: uid}, function (err, res) {
                            if (err) {
                                log.error(err);
                                return;
                            }
                            a1(res.user);
                        });
                    } else {
                        a1(user);
                    }
                });
            }
        });
    });


/* Admin SESSION */
     var createNewSession = function createNewSession(title, purpose, owner, facets, botId, cb) {
        var newSession = {
            topic: {
                title: title,
                purpose: purpose,
                facets: facets
            },
            owner: owner,
            session_id: uuid.v1(),
            botFather: botId,
            creation: new Date(),
            QProviders: [],
            FProviders: [],
            questionCorpus: [],
            CFPeriod: {from: null, to: null},    // Corpus Formation Period
            FGPeriod: {from: null, to: null}, // Feedback Gathering Period
        };
        controller.storage.sessions.save(newSession, function (err, session) {
            if (err) {
                console.log('Error saving session ' + title);
                cb(err, session);
            } else {
                console.log("New Session created: " + title);
                cb(err, session);
            }
        });
    };

    var showSessionStatus = function showSessionStatus(bot, message, session) {
        bot.reply(message, {
            text: "New Session created:",
            attachments: [
                {
                    "mrkdwn_in": ["text", "fields", 'fallback'],
                    "fallback": "Create session bot feedback",
                    "author_name": session.topic.title,
                    //"author_link": "http",
                    "author_icon": "http://www.sur54.com.ar/data/upload/news_thumbs/1349385713-600pluma_escrito_thumb_550.jpg",
                    "text": session.topic.purpose,
                    "fields": [
                        {
                            "title": "Question Providers",
                            "value": session.QProviders.length,
                            "short": true
                        },
                        {
                            "title": "Feedback Providers",
                            "value": session.FProviders.length,
                            "short": true
                        }
                    ]
                }
            ]
        });
    };

    var showSessionAdminHelp = function(bot, message, session) {
        bot.reply(message, {
            text: "Now, you can configurate your session",
            attachments: [
                {
                    "mrkdwn_in": ["text", "fields", 'fallback'],
                    "fallback": "Create session bot feedback",
                    "author_name": session.topic.title,
                    //"author_link": "http",
                    "author_icon": "http://www.sur54.com.ar/data/upload/news_thumbs/1349385713-600pluma_escrito_thumb_550.jpg",
                    "text": session.topic.purpose,
                    // TODO. Crear una estructura de datos, que contenga todos los posibles comandos del bot, en qué
                    // momento y para qué usuarios se pueden utilizar. Ej. Add Question Provider... solo lo pueden usar
                    // organizers, en el contexto de una sessión, y solo se puede en las fases previas a la fase de Corpus Formation.
                    "fields": [
                        {
                            "title": "´´´add QP [@uid]```",
                            "value": "Add Question Providers in the session, eg: ´´´add qp <@" + message.user + ">´´´",
                            "short": true
                        },
                        {
                            "title": "´´´add FP [@uid]```",
                            "value": "Add Feedback Providers in the session, eg: ´´´add qp <@" + message.user + ">´´´",
                            "short": true
                        },
                        {
                            "title": "´´´set Title```",
                            "value": "Change session title",
                            "short": true
                        },
                        {
                            "title": "´´´set Purpose```",
                            "value": "Change session purpose",
                            "short": true
                        },
                        {
                            "title": "´´´set Purpose```",
                            "value": "Change session purpose",
                            "short": true
                        }
                    ]
                }
            ]
        });
    };

    var askForSessionPurpose = function askForSessionPurpose(bot, message, user, sessionTitle, cb) {
        bot.startConversation(message, function (err, convo) {
            //convo.ask('Do you want to add a *purpose* in your new session *' + sessionTitle + "*?", [
            convo.ask('Now, you can Do you want to add a *purpose* in your new session *' + sessionTitle + "*?", [
                {
                    pattern: bot.utterances.yes,
                    callback: function (response, convo) {
                        convo.ask('Great, type the new *purpose* for *' + sessionTitle + "* session", [
                            {
                                pattern: /(.*)/i,
                                callback: function (response, convo) {
                                    convo.next();
                                    cb(null, response.text);
                                }
                            },
                            {
                                default: true,
                                callback: function (response, convo) {
                                    convo.next();
                                    cb("no purpose default");
                                }
                            }
                        ]);
                        convo.next();
                    }
                },
                {
                    pattern: bot.utterances.no,
                    callback: function (response, convo) {
                        convo.next();
                        cb("no purpose");
                    }
                },
                {
                    default: true,
                    callback: function (response, convo) {
                        convo.next();
                        cb("no purpose");
                    }
                }
            ]);
        });
    };

    var askForSessionFacets = function askForSessionFacets(bot, message, user, sessionTitle, cb) {
        bot.startConversation(message, function (err, convo) {
            convo.ask('Do you want to add *facets* for your new session *' + sessionTitle + "*?. Facets will be used to Session-Questions categorization", [
                {
                    pattern: bot.utterances.yes,
                    callback: function (response, convo) {
                        convo.ask('Great, type the new *facet* for *' + sessionTitle + "* session", [
                            {
                                pattern: /(.*)/i,
                                callback: function (response, convo) {
                                    convo.next();
                                    cb(null, response.text);
                                }
                            },
                            {
                                default: true,
                                callback: function (response, convo) {
                                    convo.next();
                                    cb("no topic default");
                                }
                            }
                        ]);
                        convo.next();
                    }
                },
                {
                    pattern: bot.utterances.no,
                    callback: function (response, convo) {
                        convo.next();
                        cb("no topic");
                    }
                },
                {
                    default: true,
                    callback: function (response, convo) {
                        convo.next();
                        cb("no topic");
                    }
                }
            ]);
        });
    };

    var askForSessionTitle = function askForSessionTitle(bot, message, user, cb) {
        bot.startConversation(message, function (err, convo) {
            convo.ask('I need a *title* for your new session, please type it now.', [
                {
                    pattern: /(.*)/i,
                    callback: function (response, convo) {
                        convo.next();
                        cb(null, response.text);
                    }
                },
                {
                    default: true,
                    callback: function (response, convo) {
                        convo.next();
                        cb("no title", "");
                    }
                }
            ]);
        });
    };

    controller.hears(['create session (.*)','new session (.*)'], 'direct_message', function (bot, message) {
        isAdmin(message.user, message.team, function (isRoot, user) {
            if (!isRoot) {
                controller.storage.owners.find({team_id: message.team}, function (err, ownerUser) {
                    if (err) {
                        console.log('error getting owner');
                    } else {
                        console.log("bot owner: <@" + ownerUser[0].id + ">");
                        // TODO checking mrkdwn
                        bot.reply(message, {
                            "text": "Only Admins can create new sessions! talk with <@" + ownerUser[0].id + ">"
                        });
                    }
                });
            } else {
                var sessionTitle = message.match[1];
                askForSessionPurpose(bot, message, user, sessionTitle, function (err, sessionTopic) {
                    if (err) {
                        convo.say("No session has been created... try again if you want");
                        return;
                    }
                    askForSessionFacets(bot, message, user, sessionTitle, function (err, facets) {
                        if (err) {
                            console.log("no facets");
                            facets = [];
                        }
                        createNewSession(sessionTitle, sessionTopic, user, facets, bot.identity.id, function (err, newSession) {
                            if (err) {
                                console.log('Error creating new session. ' + err);
                            } else {
                                showSessionStatus(bot, message, newSession);
                            }
                        });
                    });
                });
            }
        });
    });

    controller.hears(['create session','new session'], 'direct_message', function (bot, message) {
        isAdmin(message.user,  message.team, function(isRoot, user) {
            if(!isRoot) {
                controller.storage.owners.find({team_id: message.team}, function (err, ownerUser) {
                    if (err) {
                        console.log('error getting owner');
                    } else {
                        console.log("bot owner: <@" + ownerUser[0].id + ">");
                        // TODO checking mrkdwn
                        bot.reply(message, {
                            "text": "Only Admins can create new sessions! talk with <@" + ownerUser[0].id + ">"
                        });
                    }
                });
            } else {
                askForSessionTitle(bot, message, user, function(err, sessionTitle) {
                    if (err) {
                        convo.say("No session has been created... try again if you want");
                        return;
                    }
                    askForSessionPurpose(bot, message, user, sessionTitle, function(err, sessionTopic) {
                        if (err) {
                            console.log("no topic");
                            sessionTopic = "";
                        }
                        askForSessionFacets(bot, message, user, sessionTitle, function(err, facets) {
                            if (err) {
                                console.log("no facets");
                                facets = [];
                            }
                            createNewSession(sessionTitle, sessionTopic, facets, user, bot.identity.id, function(err, newSession) {
                                if (err) {
                                    convo.say("No session has been created... try again if you want");
                                    return;
                                }
                                allSessions.push(newSession);
                                showSessionStatus(bot, message, newSession);
                                showSessionAdminHelp();
                            });
                        });
                    });
                });
            }
        });
    });

    controller.on('channel_joined',function(bot, channelEv) {
        var chid = channelEv.channel.id;
        var creator = channelEv.channel.creator;
        var a1 = function(teamId, channel) {
            controller.storage.channels.get(chid, teamId, function (err, channel) {
                if (!channel || !channel.isQuestioner) {
                    console.log('<#' + chid + "> this channel is not a questioner channel!");
                    // bot cant leave channels??? :(
                    bot.api.channels.leave(chid, function(err, x) {
                        if(err) {
                            console.log('<#' + chid + ">  error leaving this channel");
                            console.log(err);
                        } else {
                            // leave question channel if not a questorioner channel
                            console.log("leaving <#" + chid + ">  channel");
                        }
                    });
                } else {
                    // set Topic
                     bot.api.channels.setTopic(channel, "Manage Scriba bot questions", function(res) {
                        if (res.ok) {
                            console.log("new Channel topic: " + res.topic);
                        } else {
                            console.log("Error changing channle topic");
                        }
                     });
                     // set Topic
                     bot.api.channels.setTopic(channel, "All people invited to this channel, can set new Scriba Bot questions.", function(res) {
                        if (res.ok) {
                            console.log("new Channel topic: " + res.topic);
                        } else {
                            console.log("Error changing channel topic");
                        }
                     });
                     // postMessage
                     var ms = "Hello! I'm  ´@" + bot.identity.name + " help´ to see what I can do";
                     bot.api.chat.postMessage(channel, ms, function(err, res) {
                         if (err) {
                             console.log(err);
                         } else {
                             console.log(res);
                         }
                     });
                }
            });
        };
        bot.api.users.info({user: creator}, function (err, res) {
            if (err) {
                log.error(err);
                return;
            }
            var team = res.user.team_id;
            bot.api.channels.info({channel: chid}, function (err, res) {
                if (err) {
                    log.error(err);
                    bot.reply(message, '<#' + chid + "> channel not found");
                    return;
                }
                a1(team, res.channel);
            });
        });

    });


/* Timers & Session Controllers */
// Init sessions
var allSessions = [];
var userStatus = [];
controller.storage.sessions.all(function (err, sessions) {
    if (err) {
        console.log('Error loading all sessions ');
    } else {
        console.log("** Init Sessions **");
        console.log(sessions);
        for (var i = 0; i < sessions.length; i++) {
            var ses = sessions[i];
            if (ses.state == '') {

            }
        }
    }
});

// Active process by events
var ringBell = function ringBell() {
    console.log('ring ring ring');
}
eventEmitter.on('doorOpen', ringBell);

eventEmitter.emit('doorOpen');