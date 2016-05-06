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

// TODO este módulo contendrá métodos para la base de datos

//  Rol Administrador total... sobre la bd debe poder hacer tod0 tipo de consultas. Establecer otros admin, establecer los canales para responder preguntas y para evaluar las respuestas.

//  Rol Preguntador. Add & Remove Questions... nice to have, añadir tipos de respuesta que espera, opciones cerradas de respuesta Tiempo que quieres que se mantenga activa, número de respuestas experado (o maximo?)

//  También podrá consultar sus preguntas realizadas, cuantas respuestas tiene cada una de ellas y que valoración tiene cada pack Q-A  (no debe saber quien responde a las preguntas ni quien las evalua)

//  Rol Respondedor. Necesitará métodos para añadir respuestas a preguntas. (En principio no se pueden cambiar las respuestas)

'use strict';

module.exports = function () {
    if (!process.env.DB_URL) {
        log.error('Error: Specify DB_URL');
        process.exit(1);
    }
    var url = process.env.DB_URL;
    var _controler = {};
    var MongoClient;
    var assert;

    /* PRIVATE */
    var constr = function constr() {
        var Promise = require("bluebird");
        Promise.promisifyAll(require("mongodb"));
        MongoClient = require('mongodb').MongoClient;
        assert = require('assert');
        return _controler;
    };

    //DEPRECATED
    var connectMongo = function connectMongo(url) {
        return MongoClient.connect(url, function(err, db) {
            assert.equal(null, err);
            return db;
        });
    };

    //DEPRECATED
    var disconnectMongo = function disconnectMongo(db) {
        return db.close();
    };

    var insertDocument = function insertDocument(db, callback, data, collect) {
        db.collection(collect).insertOne( {
            "question" : data.text,
            "owner" : data.owner,
            "timestamp" : data.timestamp,
        }, function(err, result) {
            assert.equal(err, null);
            console.log("Question inserted into collection.");
            callback();
        });
    };

    var findDocument = function findDocument(db, collect, options, callback) {
        if (!options) {
            options = {};
        }
        var aux = [];
        var cursor = db.collection(collect).find(options);
        cursor.each(function(err, doc) {
            if (doc != null) {
                aux.push(doc);
            } else {
                callback(aux);
            }
        });
    };

    /* PUBLIC */
    _controler.addQuestion = function addQuestion(message, callback) {
        MongoClient.connect(url, function(err, db) {
            assert.equal(null, err);
            return insertDocument(db, function() {
                db.close();
                callback();
            }, {
                text: message.text,
                owner: message.user,
                timestamp: new Date()
            }, 'questions');
        });
    };

    _controler.findUserQuestions = function findUserQuestions(uid, callback) {
        MongoClient.connect(url, function(err, db) {
            assert.equal(null, err);
            return findDocument(db, 'questions', {owner:uid}, function(result) {
                db.close();
                callback(result);
            });
        });
    };

    _controler.deleteQuestion = function deleteQuestion(qid, callback) {
        MongoClient.connect(url, function (err, db) {
            db.collection('questions').deleteOne({id: qid}, function (err, result) {
                assert.equal(err, null);
                callback(result);
            });

        });
    };

    _controler.deleteAllUserQuestions = function deleteAllUserQuestions(uid, callback) {
        MongoClient.connect(url, function (err, db) {
            db.collection('questions').deleteMany({owner: uid}, function (err, result) {
                assert.equal(err, null);
                callback(result);
            });
        });
    };

    return constr();
};