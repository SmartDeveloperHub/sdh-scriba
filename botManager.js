/*

    #-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=#
      This file is part of the Smart Developer Hub Project:
        http://www.smartdeveloperhub.org/
      Center for Open Middleware
            http://www.centeropenmiddleware.com/0
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

// TODO este módulo contendrá métodos para manejar el bot

// get Slack users
// hears con implementaciones distintas según el modo del usuario, root,


'use strict';

module.exports = function (dbManager, Promise) {
    log.info('Starting Scriba Bot');
    var os = require('os');
    //var Botkit = require('botkit');
    var Botkit = Promise.promisifyAll(require("botkit"));
    var controller = Botkit.slackbot();
    var _bot = controller.spawn({
        token: process.env.SLACK_BOT_TOKEN
    });
    var userMode = {};

    /* PRIVATE */
    var init = function init() {
        _bot.startRTM(function (err) {
            // Async
            if (err) {
                throw new Error('Could not connect to Slack');
            }
        });
        launchHandlers();
        return _bot;
    };
    var rootMode = function rootMode(uid) {
        if (!userMode[uid]) {
            return false;
        } else {
            return (userMode[uid].mode == 'root');
        }
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

    var launchHandlers = function launchHandlers() {
        // reply to a direct message
        controller.on('direct_message', function (bot, message) {
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

        controller.hears(['help'], 'direct_message', function (bot, message) {
            var t;
            if (rootMode(message.user)) {
                t = [
                    {
                        "title": "help",
                        "value": 'Say "help" to ScriBot',
                        "short": true
                    },
                    {
                        "title": "Add new Question",
                        "value": 'Write your questions in quotes (e.g "Give me SDH information") ',
                        "short": true
                    },
                    {
                        "title": "Remove Question",
                        "value": 'Write `remove` or `delete` and follow the instructions ',
                        "short": true
                    },
                    {
                        "title": "Check all questions",
                        "value": 'Write `status` or `all questions` to check all saved questions',
                        "short": true
                    },
                    {
                        "title": "Check user responses",
                        "value": 'Write `status @userid` to check user responses or `status @userid` ',
                        "short": true
                    }
                ];
            } else {
                t = [
                    {
                        "title": "help",
                        "value": 'Say `help` to ScriBot',
                        "short": true
                    },
                    {
                        "title": "Add new Question",
                        "value": 'Write your questions in quotes (e.g "Give me SDH information") ',
                        "short": true
                    },
                    {
                        "title": "Remove Question",
                        "value": 'Write `remove` or `delete` and follow the instructions ',
                        "short": true
                    },
                    {
                        "title": "Check your questions",
                        "value": 'write `status` or `my questions` to check your saved questions',
                        "short": true
                    }
                ];
            }
            var attach = [
                {
                    "fallback": "Help",
                    //"pretext": "Optional text that appears above the attachment block",

                    "author_name": "Scriba Help",
                    "author_icon": "https://sdh.conwet.fi.upm.es/assets/images/sdh_400ppp_RGB_imagotipo_small.png",
                    "mrkdwn_in": ["fields", "fallback"],
                    "fields": t
                }
            ];
            bot.reply(message, {
                "attachments": attach
            });
        });
        controller.hears(['status', 'my questions'], 'direct_message,direct_mention', function (bot, message) {

            dbManager.findUserQuestions(message.user, function (result) {
                var attach = getQuestionsMarkdown(result);
                bot.reply(message, {
                    "attachments": attach
                });
            });
        });

        controller.hears(['remove', 'destroy'], 'direct_message', function (bot, message) {
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

            controller.storage.users.get(message.user, function (err, user) {
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
            controller.storage.users.get(message.user, function (err, user) {
                if (!user) {
                    user = {
                        id: message.user,
                    };
                }
                user.name = name;
                controller.storage.users.save(user, function (err, id) {
                    bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
                });
            });
        });

        controller.hears(['what is my name', 'who am i'], 'direct_message', function (bot, message) {

            controller.storage.users.get(message.user, function (err, user) {
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
    };

    /* PUBLIC */
    _bot.getSlackUsers = function getSlackUsers(callback) {
        _bot.api.users.list({}, function (err, res) {
            if (err) {
                log.error(err);
                return callback([]);
            } else {
                callback(res.members);
            }
        });
    };

    /*controller.on('',function(bot,message) {

     // reply to _message_ by using the _bot_ object
     bot.reply(message,'I heard you mention me!');

     });*/

    /*controller.on('ambient',function(bot,message) {

     // reply to _message_ by using the _bot_ object
     bot.reply(message,'Ok. ambient!');

     });*/

    /*controller.on('message_received',function(bot,message) {

     // reply to _message_ by using the _bot_ object
     bot.reply(message,'Ok. message_received!');

     });*/
    /*controller.on('user_group_join',function(bot,message) {

     // reply to _message_ by using the _bot_ object
     log.warn("New user: ");
     log.debug(message);
     bot.reply(message,'Ok. user_group_join!');

     });
     controller.on('user_channel_join',function(bot,message) {

     // reply to _message_ by using the _bot_ object
     log.warn("New user: ");
     log.debug(message);
     bot.reply(message,'Ok. user_channel_join!');
     });*/
    /*controller.hears(['shutdown'],'direct_message',function(bot, message) {

     bot.startConversation(message,function(err, convo) {
     convo.ask('Are you sure you want me to shutdown?',[
     {
     pattern: bot.utterances.yes,
     callback: function(response, convo) {
     convo.say('Bye!');
     convo.next();
     setTimeout(function() {
     process.exit();
     },3000);
     }
     },
     {
     pattern: bot.utterances.no,
     default: true,
     callback: function(response, convo) {
     convo.say('*Phew!*');
     convo.next();
     }
     }
     ]);
     });
     });*/
    return init();
};