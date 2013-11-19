(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        //Allow using this built library as an AMD module
        //in another project. That other project will only
        //see this AMD call, not the internal modules in
        //the closure below.
        define(factory);
    } else {
        //Browser globals case. Just assign the
        //result to a property on the global.
        root.libGlobalName = factory();
    }
}(this, function () {
//almond, and your modules will be inlined here

/**
 * almond 0.2.6 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        if (config.deps) {
            req(config.deps, config.callback);
        }
        return req;
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("almond", function(){});

/* global define */
define('structures/CAPIError',[],function () {
    

    /**
     * Class describing any error which could be thrown during CAPI workflow
     *
     * @class CAPIError
     * @constructor
     * @param message {String} error message
     * @param additionalInfo {Object} object literal containing any additional error properties
     */
    var CAPIError = function (message, additionalInfo) {
        this.name = "CAPIError";
        this.message = message;
        this.additionalInfo = additionalInfo;
    };

    CAPIError.prototype = new Error();

    CAPIError.prototype.constructor = CAPIError;

    return CAPIError;

});
/* global define */
define('authAgents/SessionAuthAgent',["structures/CAPIError"], function (CAPIError) {
    

    /**
     * Creates an instance of SessionAuthAgent object
     * * Auth agent handles low level implementation of authorization workflow
     *
     * @class SessionAuthAgent
     * @constructor
     * @param credentials {Object} object literal containg credentials for the REST service access
     * @param credentials.login {String} user login
     * @param credentials.password {String} user password
     */
    var SessionAuthAgent = function (credentials) {
        // is initiated inside CAPI constructor by using setCAPI() method
        this._CAPI = null;

        this._login = credentials.login;
        this._password = credentials.password;

        //TODO: implement storage selection mechanism
        this.sessionName = sessionStorage.getItem('ezpRestClient.sessionName');
        this.sessionId = sessionStorage.getItem('ezpRestClient.sessionId');
        this.csrfToken = sessionStorage.getItem('ezpRestClient.csrfToken');
    };

    /**
     * Called every time a new request cycle is started,
     * to ensure those requests are correctly authenticated.
     *
     * A cycle may contain one or more queued up requests
     *
     * @method ensureAuthentication
     * @param done {Function} Callback function, which is to be called by the implementation to signal the authentication has been completed.
     */
    SessionAuthAgent.prototype.ensureAuthentication = function (done) {
        if (this.sessionId === null) {
            var that = this,
                userService = this._CAPI.getUserService(),
                sessionCreateStruct = userService.newSessionCreateStruct(
                    this._login,
                    this._password
                );

            // TODO: change hardcoded "sessions" path to discovered
            userService.createSession(
                "/api/ezp/v2/user/sessions",
                sessionCreateStruct,
                function (error, sessionResponse) {
                    if (error) {
                        done(
                            new CAPIError(
                                "Failed to create new session.",
                                {sessionCreateStruct: sessionCreateStruct}
                            ),
                            false
                        );
                        return;
                    }

                    var session = JSON.parse(sessionResponse.body).Session;

                    that.sessionName = session.name;
                    that.sessionId = session._href;
                    that.csrfToken = session.csrfToken;

                    sessionStorage.setItem('ezpRestClient.sessionName', that.sessionName);
                    sessionStorage.setItem('ezpRestClient.sessionId', that.sessionId);
                    sessionStorage.setItem('ezpRestClient.csrfToken', that.csrfToken);

                    done(false, true);
                }
            );

        } else {
            done(false, true);
        }
    };

    /**
     * Hook to allow the modification of any request, for authentication purposes, before
     * sending it out to the backend
     *
     * @method authenticateRequest
     * @param request {Request}
     * @param done {function}
     */
    SessionAuthAgent.prototype.authenticateRequest = function (request, done) {
        if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS" && request.method !== "TRACE" ) {
            request.headers["X-CSRF-Token"] = this.csrfToken;
        }

        done(false, request);
    };

    /**
     * Log out workflow
     * Kills currently active session and resets sessionStorage params (sessionId, CSRFToken)
     *
     * @method logOut
     * @param done {function}
     */
    SessionAuthAgent.prototype.logOut = function (done) {
        var userService = this._CAPI.getUserService(),
            that = this;

        userService.deleteSession(
            this.sessionId,
            function (error, response) {
                if (error) {
                    done(true, false);
                    return;
                }

                that.sessionName = null;
                that.sessionId = null;
                that.csrfToken = null;

                sessionStorage.removeItem('ezpRestClient.sessionName');
                sessionStorage.removeItem('ezpRestClient.sessionId');
                sessionStorage.removeItem('ezpRestClient.csrfToken');

                done(false, true);
            }
        );
    };

    /**
     * Set the instance of the CAPI to be used by the agent
     *
     * @method setCAPI
     * @param CAPI {CAPI} current instance of the CAPI object
     */
    SessionAuthAgent.prototype.setCAPI = function (CAPI) {
        this._CAPI = CAPI;
    };

    return SessionAuthAgent;

});
/* global define */
define('authAgents/HttpBasicAuthAgent',[],function () {
    

    /**
     * Creates an instance of HttpBasicAuthAgent object
     * Auth agent handles low level implementation of authorization workflow
     *
     * @class HttpBasicAuthAgent
     * @constructor
     * @param credentials {Object} object literal containg credentials for the REST service access
     * @param credentials.login {String} user login
     * @param credentials.password {String} user password
     */
    var HttpBasicAuthAgent = function (credentials) {
        this._login = credentials.login;
        this._password = credentials.password;
    };

    /**
     * Called every time a new request cycle is started,
     * to ensure those requests are correctly authenticated.
     *
     * A cycle may contain one or more queued up requests
     *
     * @method ensureAuthentication
     * @param done {Function} Callback function, which is to be called by the implementation
     * to signal the authentication has been completed.
     */
    HttpBasicAuthAgent.prototype.ensureAuthentication = function(done) {
        // ... empty for basic auth?
        done(false, true);
    };

    /**
     * Hook to allow the modification of any request, for authentication purposes, before
     * sending it out to the backend
     *
     * @method authenticateRequest
     * @param request {Request}
     * @param done {function}
     */
    HttpBasicAuthAgent.prototype.authenticateRequest = function (request, done) {
        request.httpBasicAuth = true;
        request.login = this._login;
        request.password = this._password;

        done(false, request);
    };

    /**
     * Log out workflow
     * No actual logic for HTTP Basic Auth
     *
     * @method logOut
     * @param done {function}
     */
    HttpBasicAuthAgent.prototype.logOut = function (done) {
        done(false, true);
    };

    /**
     * Set the instance of the CAPI to be used by the agent
     * As HttpBasicAuthAgent has no use for the CAPI, implementation is empty
     *
     * @method setCAPI
     * @param CAPI {CAPI} current instance of the CAPI object
     */
    HttpBasicAuthAgent.prototype.setCAPI = function (CAPI) {
    };

    return HttpBasicAuthAgent;

});
/* global define */
define('structures/Response',[],function () {
    

    /**
     * @class Response
     * @constructor
     * @param valuesContainer
     */
    var Response = function (valuesContainer) {
        /**
         * Body of the response (most times JSON string recieved from REST service via a Connection object)
         *
         * @property body
         * @type {String}
         * @default ""
         */
        this.body = "";

        /**
         * Document represents "body" property of the response parsed into structured object
         *
         * @property document
         * @type {Object}
         * @default null
         */
        this.document = null;

        for (var property in valuesContainer) {
            if (valuesContainer.hasOwnProperty(property)) {
                this[property] = valuesContainer[property];
            }
        }

        if ( this.body ) {
            this.document = JSON.parse(this.body);
        }

        return this;
    };

    return Response;

});
/* global define */
define('structures/Request',[],function () {
    

    /**
     * Request object used for storing all the data, which should be sent to the REST server.
     *
     * @class Request
     * @constructor
     * @param valuesContainer {Object} object literal containing any request properties
     */
    var Request = function (valuesContainer) {
        for (var property in valuesContainer) {
            if (valuesContainer.hasOwnProperty(property)) {
                this[property] = valuesContainer[property];
            }
        }

        return this;
    };

    return Request;

});
/* global define */
define('ConnectionManager',["structures/Response", "structures/Request", "structures/CAPIError"],
    function (Response, Request, CAPIError) {
    

    /**
     * Creates an instance of connection manager object
     *
     * @class ConnectionManager
     * @constructor
     * @param endPointUrl {String} url to REST root
     * @param authenticationAgent {object} Instance of one of the AuthAgents (e.g. SessionAuthAgent, HttpBasicAuthAgent)
     * @param connectionFactory {ConnectionFeatureFactory}  the factory which is choosing compatible connection from connections list
     */
    var ConnectionManager = function (endPointUrl, authenticationAgent, connectionFactory) {
        this._endPointUrl = endPointUrl;
        this._authenticationAgent = authenticationAgent;
        this._connectionFactory = connectionFactory;

        this._requestsQueue = [];
        this._authInProgress = false;

        this.logRequests = false;
    };

    /**
     * Basic request function
     *
     * @method request
     * @param [method="GET"] {String} request method ("POST", "GET" etc)
     * @param [url="/"] {String} requested REST resource
     * @param [body=""] {String} a string which should be passed in request body to the REST service
     * @param [headers={}] {object} object literal describing request headers
     * @param callback {function} function, which will be executed on request success
     */
    ConnectionManager.prototype.request = function (method, url, body, headers, callback) {
        var that = this,
            request,
            nextRequest,
            defaultMethod = "GET",
            defaultUrl = "/",
            defaultBody = "",
            defaultHeaders = {};

        // default values for omitted parameters (if any)
        if (arguments.length < 5) {
            if (typeof method == "function") {
                //no optional parameteres are passed
                callback = method;
                method = defaultMethod;
                url = defaultUrl;
                body = defaultBody;
                headers = defaultHeaders;
            } else if (typeof url == "function") {
                // only first 1 optional parameter is passed
                callback = url;
                url = defaultUrl;
                body = defaultBody;
                headers = defaultHeaders;
            } else if (typeof body == "function") {
                // only first 2 optional parameters are passed
                callback = body;
                body = defaultBody;
                headers = defaultHeaders;
            } else {
                // only first 3 optional parameters are passed
                callback = headers;
                headers = defaultHeaders;
            }
        }

        request = new Request({
            method : method,
            url : this._endPointUrl + url,
            body : body,
            headers : headers
        });

        // Requests suspending workflow
        // first, put any request in queue anyway (the queue will be emptied after ensuring authentication)
        this._requestsQueue.push(request);

        // if our request is the first one, or authorization is not in progress, go on
        if (!this._authInProgress || (this._requestsQueue.length === 1)) {
            // queue all other requests, until this one is authenticated
            this._authInProgress = true;

            // check if we are already authenticated, make it happen if not
            this._authenticationAgent.ensureAuthentication(
                function (error, success) {
                    if (error) {
                        that._authInProgress = false;
                        callback(error, false);
                        return;
                    }

                    that._authInProgress = false;

                    // emptying requests Queue
                    /*jshint boss:true */
                    /*jshint -W083 */
                    while (nextRequest = that._requestsQueue.shift()) {
                        that._authenticationAgent.authenticateRequest(
                            nextRequest,
                            function (error, authenticatedRequest) {
                                if (error) {
                                    callback(
                                        new CAPIError(
                                            "An error occurred during request authentication.",
                                            {request: nextRequest}
                                        ),
                                        false
                                    );
                                    return;
                                }

                                if (that.logRequests) {
                                    console.dir(request);
                                }
                                // Main goal
                                that._connectionFactory.createConnection().execute(authenticatedRequest, callback);
                            }
                        );
                    } // while
                    /*jshint +W083 */
                    /*jshint boss:false */
                }
            );
        }
    };

    /**
     * Not authorized request function
     * Used mainly for initial requests (e.g. createSession)
     *
     * @method notAuthorizedRequest
     * @param [method="GET"] {String} request method ("POST", "GET" etc)
     * @param [url="/"] {String} requested REST resource
     * @param [body=""] {String} a string which should be passed in request body to the REST service
     * @param [headers={}] {object} object literal describing request headers
     * @param callback {function} function, which will be executed on request success
     */
    ConnectionManager.prototype.notAuthorizedRequest = function(method, url, body, headers, callback) {
        var request,
            defaultMethod = "GET",
            defaultUrl = "/",
            defaultBody = "",
            defaultHeaders = {};

        // default values for omitted parameters (if any)
        if (arguments.length < 5) {
            if (typeof method == "function") {
                //no optional parameteres are passed
                callback = method;
                method = defaultMethod;
                url = defaultUrl;
                body = defaultBody;
                headers = defaultHeaders;
            } else if (typeof url == "function") {
                // only first 1 optional parameter is passed
                callback = url;
                url = defaultUrl;
                body = defaultBody;
                headers = defaultHeaders;
            } else if (typeof body == "function") {
                // only first 2 optional parameters are passed
                callback = body;
                body = defaultBody;
                headers = defaultHeaders;
            } else {
                // only first 3 optional parameters are passed
                callback = headers;
                headers = defaultHeaders;
            }
        }

        request = new Request({
            method: method,
            url: this._endPointUrl + url,
            body: body,
            headers: headers
        });

        if (this.logRequests) {
            console.dir(request);
        }

        // Main goal
        this._connectionFactory.createConnection().execute(request, callback);
    };

    /**
     * Delete - shortcut which handles simple deletion requests in most cases
     *
     * @method delete
     * @param url {String} target REST resource
     * @param callback {function} function, which will be executed on request success
     */
    ConnectionManager.prototype.delete = function (url, callback) {
        this.request(
            "DELETE",
            url,
            "",
            {},
            callback
        );
    };

    /**
     * logOut - logout workflow
     * Kills currently active session and resets localStorage params (sessionId, CSRFToken)
     *
     * @method logOut
     * @param callback {function} function, which will be executed on request success
     */
    ConnectionManager.prototype.logOut = function (callback) {
        this._authenticationAgent.logOut(callback);
    };

    return ConnectionManager;

});

/* global define */
define('ConnectionFeatureFactory',[],function () {
    

    /**
     * Creates an instance of connection feature factory. This factory is choosing compatible connection from list of available connections.
     *
     * @class ConnectionFeatureFactory
     * @constructor
     * @param connectionList {array} Array of connections, should be filled-in in preferred order
     */
    var ConnectionFeatureFactory = function (connectionList) {
        this.connectionList = connectionList;

        this.defaultFactory = function (Connection) {
            return new Connection();
        };
    };

    /**
     * Returns instance of the very first compatible connection from the list
     *
     * @method createConnection
     * @return  {Connection}
     */
    ConnectionFeatureFactory.prototype.createConnection = function () {
        var connection = null,
            index = 0;

        // Choosing and creating first compatible connection from connection list
        for (index = 0; index < this.connectionList.length; ++index) {
            if (this.connectionList[index].connection.isCompatible()) {
                if (this.connectionList[index].factory) {
                    connection = this.connectionList[index].factory(this.connectionList[index].connection);
                } else {
                    connection = this.defaultFactory(this.connectionList[index].connection);
                }
                break;
            }
        }

        return connection;
    };

    return ConnectionFeatureFactory;

});
/* global define */
define('connections/XmlHttpRequestConnection',["structures/Response", "structures/CAPIError"], function (Response, CAPIError) {
    

    /**
     * Creates an instance of XmlHttpRequestConnection object
     * This connection class handles low-level implementation of XHR connection for generic (non-Microsoft) browsers
     *
     * @class XmlHttpRequestConnection
     * @constructor
     */
    var XmlHttpRequestConnection = function () {
        this._xhr = new XMLHttpRequest();

        /**
         * Basic request implemented via XHR technique
         *
         * @method execute
         * @param request {Request} structure containing all needed params and data
         * @param callback {function} function, which will be executed on request success
         */
        this.execute = function (request, callback) {
            var XHR = this._xhr,
                headerType;

            // Create the state change handler:
            XHR.onreadystatechange = function () {
                if (XHR.readyState != 4) {return;} // Not ready yet
                if (XHR.status >= 400) {
                    callback(
                        new CAPIError("Connection error : " + XHR.status + ".", {
                            errorCode : XHR.status,
                            xhr: XHR
                        }),
                        false
                    );
                    return;
                }
                // Request successful
                callback(
                    false,
                    new Response({
                        status: XHR.status,
                        headers: XHR.getAllResponseHeaders(),
                        body: XHR.responseText
                    })
                );
            };

            if (request.httpBasicAuth) {
                XHR.open(request.method, request.url, true, request.login, request.password);
            } else {
                XHR.open(request.method, request.url, true);
            }

            for (headerType in request.headers) {
                if (request.headers.hasOwnProperty(headerType)) {
                    XHR.setRequestHeader(
                        headerType,
                        request.headers[headerType]
                    );
                }
            }
            XHR.send(request.body);
        };
    };

    /**
     * Connection checks itself for compatibility with running environment
     *
     * @method isCompatible
     * @static
     * @return {boolean} whether the connection is compatible with current environment
     */
    XmlHttpRequestConnection.isCompatible = function () {
        return !!window.XMLHttpRequest;
    };

    return XmlHttpRequestConnection;

});
/* global define */
/* global ActiveXObject */
define('connections/MicrosoftXmlHttpRequestConnection',["structures/Response", "structures/CAPIError"], function (Response, CAPIError) {
    

    /**
     * Creates an instance of MicrosoftXmlHttpRequestConnection object
     * This connection class handles low-level implementation of XHR connection for Microsoft browsers
     *
     * @class MicrosoftXmlHttpRequestConnection
     * @constructor
     */
    var MicrosoftXmlHttpRequestConnection = function () {
        this._xhr = new ActiveXObject("Microsoft.XMLHTTP");

        /**
         * Basic request implemented via XHR technique
         *
         * @method execute
         * @param request {Request} structure containing all needed params and data
         * @param callback {function} function, which will be executed on request success
         */
        this.execute = function (request, callback) {
            var XHR = this._xhr,
                headerType;

            // Create the state change handler:
            XHR.onreadystatechange = function () {
                if (XHR.readyState != 4) {return;} // Not ready yet
                if (XHR.status >= 400) {
                    callback(
                        new CAPIError("Connection error : " + XHR.status + ".", {
                            errorCode : XHR.status,
                            xhr: XHR
                        }),
                        false
                    );
                    return;
                }
                // Request successful
                callback(
                    false,
                    new Response({
                        status: XHR.status,
                        headers: XHR.getAllResponseHeaders(),
                        body: XHR.responseText
                    })
                );
            };

            if (request.httpBasicAuth) {
                XHR.open(request.method, request.url, true, request.login, request.password);
            } else {
                XHR.open(request.method, request.url, true);
            }

            for (headerType in request.headers) {
                if (request.headers.hasOwnProperty(headerType)) {
                    XHR.setRequestHeader(
                        headerType,
                        request.headers[headerType]
                    );
                }
            }
            XHR.send(request.body);
        };
    };

    /**
     * Connection checks itself for compatibility with running environment
     *
     * @method isCompatible
     * @static
     * @return {boolean} whether the connection is compatible with current environment
     */
    MicrosoftXmlHttpRequestConnection.isCompatible = function () {
        return !!window.ActiveXObject;
    };

    return MicrosoftXmlHttpRequestConnection;

});
/* global define */
define('services/DiscoveryService',["structures/CAPIError"], function (CAPIError) {
    

    /**
     * Creates an instance of discovery service.
     * Discovery service is used internally to auto-discover and cache misc useful REST objects.
     *
     * @class DiscoveryService
     * @constructor
     * @param rootPath {String} path to Root resource
     * @param connectionManager {ConnectionManager}
     */
    var DiscoveryService = function (rootPath, connectionManager) {
        this.connectionManager = connectionManager;
        this.rootPath = rootPath;
        this.cacheObject = {};
    };

    /**
     * Try to get url of the target object by given 'name'
     *
     * @method getUrl
     * @param name {String} name of the target object (e.g. "Trash")
     * @param callback {Function} callback executed after performing the request (see "_discoverRoot" call for more info)
     * @param callback.error {mixed} false or CAPIError object if an error occurred
     * @param callback.response {mixed} the url of the target object if it was found, false otherwise.
     */
    DiscoveryService.prototype.getUrl = function (name, callback) {
        this._getObjectFromCache(
            name,
            function (error, cachedObject) {
                if (error) {
                    callback(error, false);
                    return;
                }

                callback(false, cachedObject._href);
            }
        );
    };

    /**
     * Try to get media-type of the target object by given 'name'
     *
     * @method getMediaType
     * @param name {String} name of the target object (e.g. "Trash")
     * @param callback {Function} callback executed after performing the request (see "_discoverRoot" call for more info)
     * @param callback.error {mixed} false or CAPIError object if an error occurred
     * @param callback.response {mixed} the media-type of the target object if it was found, false otherwise.
     */
    DiscoveryService.prototype.getMediaType = function (name, callback) {
        this._getObjectFromCache(
            name,
            function (error, cachedObject) {
                if (error) {
                    callback(error, false);
                    return;
                }

                callback(false, cachedObject["_media-type"]);
            }
        );
    };

    /**
     * Try to get the whole target object by given 'name'
     *
     * @method getInfoObject
     * @param name {String} name of the target object (e.g. "Trash")
     * @param callback {Function} callback executed after performing the request (see "_discoverRoot" call for more info)
     * @param callback.error {mixed} false or CAPIError object if an error occurred
     * @param callback.response {mixed} the target object if it was found, false otherwise.
     */
    DiscoveryService.prototype.getInfoObject = function (name, callback) {
        this._getObjectFromCache(
            name,
            function (error, cachedObject) {
                if (error) {
                    callback(error, false);
                    return;
                }

                callback(false, cachedObject);
            }
        );
    };

    /**
     * discover Root object
     *
     * @method _discoverRoot
     * @param rootPath {String} path to Root resource
     * @param callback {Function} callback executed after performing the request
     * @param callback.error {mixed} false or CAPIError object if an error occurred
     * @param callback.response {boolean} true if the root was discovered successfully, false otherwise.
     * @protected
     */
    DiscoveryService.prototype._discoverRoot = function (rootPath, callback) {
        if (!this.cacheObject.Root) {
            var that = this;
            this.connectionManager.request(
                "GET",
                rootPath,
                "",
                {"Accept": "application/vnd.ez.api.Root+json"},
                function (error, rootJSON) {
                    if (error) {
                        callback(error, false);
                        return;
                    }

                    that._copyToCache(rootJSON.document);
                    callback(false, true);
                }
            );
        } else {
            callback(false, true);
        }
    };

    /**
     * Copy all the properties of the target object into the cache object
     *
     * @method _copyToCache
     * @param object {Object} target object
     * @protected
     */
    DiscoveryService.prototype._copyToCache = function (object) {
        for (var property in object) {
            if (object.hasOwnProperty(property) && object[property]) {
                this.cacheObject[property] = object[property];
            }
        }
    };

    /**
     * Get target object from cacheObject by given 'name' and run the discovery process if it is not available.
     *
     * @method _getObjectFromCache
     * @param name {String} name of the target object to be retrived (e.g. "Trash")
     * @param callback {Function} callback executed after performing the request
     * @param callback.error {mixed} false or CAPIError object if an error occurred
     * @param callback.response {mixed} the target object if it was found, false otherwise.
     * @protected
     */
    DiscoveryService.prototype._getObjectFromCache = function (name, callback) {
        var object = null,
            that = this;
        // Discovering root, if not yet discovered
        // on discovery running the request for same 'name' again
        if (!this.cacheObject.Root) {
            this._discoverRoot(this.rootPath, function (error, success) {
                if (error) {
                    callback(error, false);
                    return;
                }
                that._getObjectFromCache(name, callback);
            });
            return;
        }

        // Checking most obvious places for now
        // "Root" object (retrieved during root discovery request) and
        // root of a cache object in case we have cached value from some other request
        if (this.cacheObject.Root.hasOwnProperty(name)) {
            object = this.cacheObject.Root[name];
        } else if (this.cacheObject.hasOwnProperty(name)) {
            object = this.cacheObject[name];
        }

        if (object) {
            callback(false, object);
        } else {
            callback(
                new CAPIError(
                    "Discover service failed to find cached object with name '" + name + "'.",
                    {name: name}
                ),
                false
            );
        }
    };

    return DiscoveryService;

});
/* global define */
define('structures/ContentCreateStruct',[],function () {
    

    /**
     * Returns a structure used to create a new Content object. See
     * {{#crossLink "ContentService/createContent"}}ContentService.createContent{{/crossLink}}
     *
     * @class ContentCreateStruct
     * @constructor
     * @param contentTypeId {String} Content Type for new Content object (e.g. "blog")
     * @param locationCreateStruct {LocationCreateStruct} create structure for a Location object, where the new Content object will be situated
     * @param languageCode {String} The language code (e.g. "eng-GB")
     */
    var ContentCreateStruct = function (contentTypeId, locationCreateStruct, languageCode) {
        var now = JSON.parse(JSON.stringify(new Date()));

        this.body = {};
        this.body.ContentCreate = {};

        this.body.ContentCreate.ContentType = {
                "_href": contentTypeId
            };

        this.body.ContentCreate.mainLanguageCode = languageCode;
        this.body.ContentCreate.LocationCreate = locationCreateStruct.body.LocationCreate;

        this.body.ContentCreate.Section = null;
        this.body.ContentCreate.alwaysAvailable = "true";
        this.body.ContentCreate.remoteId = null;
        this.body.ContentCreate.modificationDate = now;
        this.body.ContentCreate.fields = {};
        this.body.ContentCreate.fields.field = [];

        this.headers = {
            "Accept": "application/vnd.ez.api.Content+json",
            "Content-Type": "application/vnd.ez.api.ContentCreate+json"
        };

        return this;
    };

    return ContentCreateStruct;

});

/* global define */
define('structures/ContentUpdateStruct',[],function () {
    

    /**
     * Returns a structure used to update a Content object. See
     * {{#crossLink "ContentService/updateContent"}}ContentService.updateContent{{/crossLink}}
     *
     * @class ContentUpdateStruct
     * @constructor
     * @param languageCode {String} The language code (eng-GB, fre-FR, ...)
     */
    var ContentUpdateStruct = function (languageCode) {
        var now = JSON.parse(JSON.stringify(new Date()));

        this.body = {};
        this.body.VersionUpdate = {};

        this.body.VersionUpdate.modificationDate = now;
        this.body.VersionUpdate.initialLanguageCode = languageCode;
        this.body.VersionUpdate.fields = {
            "field": []
        };

        this.headers = {
            "Accept": "application/vnd.ez.api.Version+json",
            "Content-Type": "application/vnd.ez.api.VersionUpdate+json"
        };

        return this;
    };

    return ContentUpdateStruct;

});

/* global define */
define('structures/SectionInputStruct',[],function () {
    

    /**
     * Returns a structure used to create and update a Section. See for ex.
     * {{#crossLink "ContentService/createSection"}}ContentService.createSection{{/crossLink}}
     *
     * @class SectionInputStruct
     * @constructor
     * @param identifier {String} unique section identifier
     * @param name {String} section name

     */
    var SectionInputStruct = function (identifier, name) {
        this.body = {};
        this.body.SectionInput = {};

        this.body.SectionInput.identifier = identifier;
        this.body.SectionInput.name = name;

        this.headers = {};
        this.headers.Accept = "application/vnd.ez.api.Section+json";
        this.headers["Content-Type"] = "application/vnd.ez.api.SectionInput+json";

        return this;
    };

    return SectionInputStruct;

});
/* global define */
define('structures/LocationCreateStruct',[],function () {
    

    /**
     * Returns a structure used to create a new Location. See
     * {{#crossLink "ContentService/createLocation"}}ContentService.createLocation{{/crossLink}}
     *
     * @class LocationCreateStruct
     * @constructor
     * @param parentLocationId {String} reference to the parent location of the new Location.
     */
    var LocationCreateStruct = function (parentLocationId) {
        this.body = {};
        this.body.LocationCreate = {};

        this.body.LocationCreate.ParentLocation = {
            "_href": parentLocationId
        };

        this.body.LocationCreate.sortField = "PATH";
        this.body.LocationCreate.sortOrder = "ASC";

        this.headers = {
            "Accept": "application/vnd.ez.api.Location+json",
            "Content-Type": "application/vnd.ez.api.LocationCreate+json"
        };

        return this;
    };

    return LocationCreateStruct;

});

/* global define */
define('structures/LocationUpdateStruct',[],function () {
    

    /**
     * Returns a structure used to update a Location. See
     * {{#crossLink "ContentService/updateLocation"}}ContentService.updateLocation{{/crossLink}}
     *
     * @class LocationUpdateStruct
     * @constructor
     */
    var LocationUpdateStruct = function () {
        this.body = {};
        this.body.LocationUpdate = {};

        this.body.LocationUpdate.sortField = "PATH";
        this.body.LocationUpdate.sortOrder = "ASC";

        this.headers = {
            "Accept": "application/vnd.ez.api.Location+json",
            "Content-Type": "application/vnd.ez.api.LocationUpdate+json"
        };

        return this;
    };

    return LocationUpdateStruct;

});
/* global define */
define('structures/ContentMetadataUpdateStruct',[],function () {
    

    /**
     * Returns a structure used to update a Content's metadata. See
     * {{#crossLink "ContentService/updateContentMetadata"}}ContentService.updateContentMetadata{{/crossLink}}
     *
     * @class ContentMetadataUpdateStruct
     * @constructor
     * @param languageCode {String} The language code (eng-GB, fre-FR, ...)
     */
    var ContentMetadataUpdateStruct = function (languageCode) {
        var now = JSON.parse(JSON.stringify(new Date()));

        this.body = {};
        this.body.ContentUpdate = {};

        this.body.ContentUpdate.MainLanguageCode = languageCode;
        this.body.ContentUpdate.Section = null;
        this.body.ContentUpdate.alwaysAvailable = "true";
        this.body.ContentUpdate.remoteId = null;
        this.body.ContentUpdate.modificationDate = now;
        this.body.ContentUpdate.publishDate = null;

        this.headers = {
            "Accept": "application/vnd.ez.api.ContentInfo+json",
            "Content-Type": "application/vnd.ez.api.ContentUpdate+json"
        };

        return this;
    };

    return ContentMetadataUpdateStruct;

});

/* global define */
define('structures/ObjectStateGroupCreateStruct',[],function () {
    

    /**
     * Returns a structure used to create a new Object State group. See
     * {{#crossLink "ContentService/createObjectStateGroup"}}ContentService.createObjectStateGroup{{/crossLink}}
     *
     * @class ObjectStateGroupCreateStruct
     * @constructor
     * @param identifier {String} unique ObjectStateGroup identifier
     * @param languageCode {String} The language code (eng-GB, fre-FR, ...)
     * @param names {Array} Multi language value (see the example)
     * @example
     *      var objectStateGroupCreateStruct = contentService.newObjectStateGroupCreateStruct(
     *          "some-id",
     *          "eng-US",
     *          [
     *              {
     *                  "_languageCode":"eng-US",
     *                  "#text":"Some Name"
     *              }
     *          ]
     *      );
     */
    var ObjectStateGroupCreateStruct = function (identifier, languageCode, names) {
        this.body = {};
        this.body.ObjectStateGroupCreate = {};

        this.body.ObjectStateGroupCreate.identifier = identifier;
        this.body.ObjectStateGroupCreate.defaultLanguageCode = languageCode;

        this.body.ObjectStateGroupCreate.names = {};
        this.body.ObjectStateGroupCreate.names.value = names;

        this.body.ObjectStateGroupCreate.descriptions = {};
        this.body.ObjectStateGroupCreate.descriptions.value = [];

        this.headers = {};
        this.headers.Accept = "application/vnd.ez.api.ObjectStateGroup+json";
        this.headers["Content-Type"] = "application/vnd.ez.api.ObjectStateGroupCreate+json";

        return this;
    };

    return ObjectStateGroupCreateStruct;

});
/* global define */
define('structures/ObjectStateGroupUpdateStruct',[],function () {
    

    /**
     * Returns a structure used to update an Object State group. See
     * {{#crossLink "ContentService/updateObjectStateGroup"}}ContentService.updateObjectStateGroup{{/crossLink}}
     *
     * @class ObjectStateGroupUpdateStruct
     * @constructor
     */
    var ObjectStateGroupUpdateStruct = function () {
        this.body = {};
        this.body.ObjectStateGroupUpdate = {};

        this.headers = {};
        this.headers.Accept = "application/vnd.ez.api.ObjectStateGroup+json";
        this.headers["Content-Type"] = "application/vnd.ez.api.ObjectStateGroupUpdate+json";

        return this;
    };

    return ObjectStateGroupUpdateStruct;

});
/* global define */
define('structures/ObjectStateCreateStruct',[],function () {
    

    /**
     * Returns a structure used to create a new Object State. See
     * {{#crossLink "ContentService/createObjectState"}}ContentService.createObjectState{{/crossLink}}
     *
     * @class ObjectStateCreateStruct
     * @constructor
     * @param identifier {String} unique ObjectState identifier (e.g. "some-new-state")
     * @param languageCode {String} The language code (eng-GB, fre-FR, ...)
     * @param priority {int}
     * @param names {Array} Multi language value (see example)
     * @param descriptions {Array} Multi language value (see example)
     * @example
     *      var objectStateCreateStruct = contentService.newObjectStateCreateStruct(
     *          "some-id",
     *          "eng-US",
     *          0,
     *          [
     *              {
     *                  "_languageCode":"eng-US",
     *                  "#text":"Some Name"
     *              }
     *          ],
     *          [
     *              {
     *                  "_languageCode":"eng-US",
     *                  "#text":"Some Description"
     *              }
     *          ]
     *      );
     */
    var ObjectStateCreateStruct = function (identifier, languageCode, priority, names, descriptions) {
        this.body = {};
        this.body.ObjectStateCreate = {};

        this.body.ObjectStateCreate.identifier = identifier;
        this.body.ObjectStateCreate.defaultLanguageCode = languageCode;
        this.body.ObjectStateCreate.priority = priority;
        this.body.ObjectStateCreate.names = {};
        this.body.ObjectStateCreate.names.value = names;
        this.body.ObjectStateCreate.descriptions = {};
        this.body.ObjectStateCreate.descriptions.value = descriptions;

        this.headers = {};
        this.headers.Accept = "application/vnd.ez.api.ObjectState+json";
        this.headers["Content-Type"] = "application/vnd.ez.api.ObjectStateCreate+json";

        return this;
    };

    return ObjectStateCreateStruct;

});
/* global define */
define('structures/ObjectStateUpdateStruct',[],function () {
    

    /**
     * Returns a structure used to update an Object State. See
     * {{#crossLink "ContentService/updateObjectState"}}ContentService.updateObjectState{{/crossLink}}
     *
     * @class ObjectStateUpdateStruct
     * @constructor
     */
    var ObjectStateUpdateStruct = function () {
        this.body = {};
        this.body.ObjectStateUpdate = {};

        this.headers = {};
        this.headers.Accept = "application/vnd.ez.api.ObjectState+json";
        this.headers["Content-Type"] = "application/vnd.ez.api.ObjectStateUpdate+json";

        return this;
    };

    return ObjectStateUpdateStruct;

});
/* global define */
define('structures/ViewCreateStruct',[],function () {
    

    /**
     * Returns a structure used to create a new View. See
     * {{#crossLink "ContentService/createView"}}ContentService.createView{{/crossLink}}
     *
     * @class ViewCreateStruct
     * @constructor
     * @param identifier {String} unique view identifier
     */
    var ViewCreateStruct = function (identifier) {
        this.body = {};
        this.body.ViewInput = {};

        this.body.ViewInput.identifier = identifier;
        this.body.ViewInput.public = false;
        this.body.ViewInput.Query = {};

        this.body.ViewInput.Query.Criteria = {};
        this.body.ViewInput.Query.offset = 0;
        this.body.ViewInput.Query.FacetBuilders = {};
        this.body.ViewInput.Query.SortClauses = {};
        this.body.ViewInput.Query.spellcheck = false;

        this.headers = {
            "Accept": "application/vnd.ez.api.View+json",
            "Content-Type": "application/vnd.ez.api.ViewInput+json"
        };

        return this;
    };

    return ViewCreateStruct;

});
/* global define */
define('structures/UrlAliasCreateStruct',[],function () {
    

    /**
     * Returns a structure used to create a new UrlAlias object. See
     * {{#crossLink "ContentService/createUrlAlias"}}ContentService.createUrlAlias{{/crossLink}}
     *
     * @class UrlAliasCreateStruct
     * @constructor
     * @param languageCode {String} The language code (eng-GB, fre-FR, ...)
     * @param resource {String} eZ Publish resource you want to create alias for
     * @param path {String} the new alias itself
     * @example
     *     var urlAliasCreateStruct = contentService.newUrlAliasCreateStruct(
     *         "eng-US",
     *         "content/search",
     *         "findme-alias"
     *     );
     */
    var UrlAliasCreateStruct = function (languageCode, resource, path) {
        this.body = {};
        this.body.UrlAliasCreate = {};

        this.body.UrlAliasCreate._type = "RESOURCE";

        this.body.UrlAliasCreate.resource = resource;
        this.body.UrlAliasCreate.path = path;

        this.body.UrlAliasCreate.alwaysAvailable = "false";
        this.body.UrlAliasCreate.forward = "false";
        this.body.UrlAliasCreate.languageCode = languageCode;

        this.headers = {};
        this.headers.Accept = "application/vnd.ez.api.UrlAlias+json";
        this.headers["Content-Type"] = "application/vnd.ez.api.UrlAliasCreate+json";

        return this;
    };

    return UrlAliasCreateStruct;

});
/* global define */
define('structures/UrlWildcardCreateStruct',[],function () {
    

    /**
     * Returns a structure used to create a new Url Wildcard object. See
     * {{#crossLink "ContentService/createUrlWildcard"}}ContentService.createUrlWildcard{{/crossLink}}
     *
     * @class UrlWildcardCreateStruct
     * @constructor
     * @param sourceUrl {String} new url wildcard
     * @param destinationUrl {String} existing resource where wildcard should point
     * @param forward {boolean} weather or not the wildcard should redirect to the resource
     */
    var UrlWildcardCreateStruct = function (sourceUrl, destinationUrl, forward) {
        this.body = {};
        this.body.UrlWildcardCreate = {};

        this.body.UrlWildcardCreate.sourceUrl = sourceUrl;
        this.body.UrlWildcardCreate.destinationUrl = destinationUrl;
        this.body.UrlWildcardCreate.forward = forward;

        this.headers = {};
        this.headers.Accept = "application/vnd.ez.api.UrlWildcard+json";
        this.headers["Content-Type"] = "application/vnd.ez.api.UrlWildcardCreate+json";

        return this;
    };

    return UrlWildcardCreateStruct;

});
/* global define */
define('structures/RelationCreateStruct',[],function () {
    

    /**
     * Returns a structure used to create a new Content object. See
     * {{#crossLink "ContentService/addRelation"}}ContentService.addRelation{{/crossLink}}
     *
     * @class RelationCreateStruct
     * @constructor
     * @param destination {String} reference to the resource we want to make related
     */
    var RelationCreateStruct = function (destination) {
        this.body = {};
        this.body.RelationCreate = {};
        this.body.RelationCreate.Destination = {
            _href: destination
        };

        this.headers = {};
        this.headers.Accept = "application/vnd.ez.api.Relation+json";
        this.headers["Content-Type"] = "application/vnd.ez.api.RelationCreate+json";

        return this;
    };

    return RelationCreateStruct;

});
/* global define */
define('services/ContentService',["structures/ContentCreateStruct", "structures/ContentUpdateStruct", "structures/SectionInputStruct",
        "structures/LocationCreateStruct", "structures/LocationUpdateStruct", "structures/ContentMetadataUpdateStruct",
        "structures/ObjectStateGroupCreateStruct", "structures/ObjectStateGroupUpdateStruct", "structures/ObjectStateCreateStruct",
        "structures/ObjectStateUpdateStruct", "structures/ViewCreateStruct", "structures/UrlAliasCreateStruct",
        "structures/UrlWildcardCreateStruct", "structures/RelationCreateStruct"],
    function (ContentCreateStruct, ContentUpdateStruct, SectionInputStruct,
              LocationCreateStruct, LocationUpdateStruct, ContentMetadataUpdateStruct,
              ObjectStateGroupCreateStruct, ObjectStateGroupUpdateStruct, ObjectStateCreateStruct,
              ObjectStateUpdateStruct, ViewCreateStruct, UrlAliasCreateStruct,
              UrlWildcardCreateStruct, RelationCreateStruct) {
    

    /**
     * Creates an instance of Content Service object. Use ContentService to retrieve information and execute operations related to Content.
     *
     * ## Note on the *callbacks* usage
     *
     * The **callback** argument of the service methods always take 2 arguments:
     *
     *    *     **error** either `false` or {{#crossLink "CAPIError"}}CAPIError{{/crossLink}} object when an error occurred
     *
     *    *     **response** the {{#crossLink "Response"}}Response{{/crossLink}} object
     *
     * Example:
     *
     *     contentService.loadRoot("/api/ezp/v2/", function (error, response) {
     *            if (error) {
     *                console.log('An error occurred', error);
     *            } else {
     *                console.log('Success!', response);
     *            }
     *     });
     *
     * @class ContentService
     * @constructor
     * @param connectionManager {ConnectionManager} connection manager that will be used to send requests to REST service
     * @param discoveryService {DiscoveryService} is handling REST paths auto-discovery
     * @example
     *     var contentService = jsCAPI.getContentService();
     */
    var ContentService = function (connectionManager, discoveryService) {
        this._connectionManager = connectionManager;
        this._discoveryService = discoveryService;
    };

    /**
     * List the root resources of the eZ Publish installation. Root resources contain many paths and references to other parts of the REST interface.
     * This call is used by DiscoveryService automatically, whenever needed.
     *
     * @method loadRoot
     * @param rootPath {String} path to Root resource
     * @param callback {Function} callback executed after performing the request (see
     * {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.loadRoot = function (rootPath, callback) {
        this._connectionManager.request(
            "GET",
            rootPath,
            "",
            {"Accept": "application/vnd.ez.api.Root+json"},
            callback
        );
    };

// ******************************
// Structures
// ******************************

    /**
     * Returns update structure for Content object
     *
     * @method newContentUpdateStruct
     * @param language {String} The language code (eng-GB, fre-FR, ...)
     * @return {ContentUpdateStruct}
     *
     */
    ContentService.prototype.newContentUpdateStruct = function (language) {
        return new ContentUpdateStruct(language);
    };

    /**
     * Returns update structure for Content object metadata
     *
     * @method newContentMetadataUpdateStruct
     * @param language {String} The language code (eng-GB, fre-FR, ...)
     * @return ContentMetadataUpdateStruct
     */
    ContentService.prototype.newContentMetadataUpdateStruct = function (language) {
        return new ContentMetadataUpdateStruct(language);
    };

    /**
     * Returns create structure for Content object
     *
     * @method newContentCreateStruct
     * @param contentTypeId {String} Content Type for new Content object (e.g.: /api/v2/ezp/content/type/1)
     * @param locationCreateStruct {LocationCreateStruct} create structure for a Location object, where the new Content object will be situated
     * @param language {String} The language code (eng-GB, fre-FR, ...)
     * @return {ContentCreateStruct}
     */
    ContentService.prototype.newContentCreateStruct = function (contentTypeId, locationCreateStruct, language) {
        return new ContentCreateStruct(contentTypeId, locationCreateStruct, language);
    };

    /**
     * Returns input structure for Section object. Input structure is needed while creating and updating the object.
     *
     * @method newSectionInputStruct
     * @param identifier {String} unique section identifier (e.g. "media")
     * @param name {String} section name (e.g. "Media")
     * @return {SectionInputStruct}
     */
    ContentService.prototype.newSectionInputStruct = function (identifier, name) {
        return new SectionInputStruct(identifier, name);
    };

    /**
     * Returns create structure for Location object
     *
     * @method newLocationCreateStruct
     * @param parentLocationId {String} Reference to the parent location of the new Location. (e.g. "/api/ezp/v2/content/locations/1/2/118")
     * @return {LocationCreateStruct}
     */
    ContentService.prototype.newLocationCreateStruct = function (parentLocationId) {
        return new LocationCreateStruct(parentLocationId);
    };

    /**
     * Returns update structure for Location object
     *
     * @method newLocationUpdateStruct
     * @return {LocationUpdateStruct}
     */
    ContentService.prototype.newLocationUpdateStruct = function () {
        return new LocationUpdateStruct();
    };

    /**
     * Returns create structure for View object
     *
     * @method newViewCreateStruct
     * @param identifier {String} unique view identifier (e.g. "my-new-view")
     * @return {ViewCreateStruct}
     */
    ContentService.prototype.newViewCreateStruct = function (identifier) {
        return new ViewCreateStruct(identifier);
    };

    /**
     * Returns create structure for Relation
     *
     * @method newRelationCreateStruct
     * @param destination {String} reference to the resource we want to make related
     * @return {RelationCreateStruct}
     */
    ContentService.prototype.newRelationCreateStruct = function (destination) {
        return new RelationCreateStruct(destination);
    };

    /**
     * Returns create structure for ObjectStateGroup
     *
     * @method newObjectStateGroupCreateStruct
     * @param identifier {String} unique ObjectStateGroup identifier (e.g. "some-new-group")
     * @param languageCode {String} The language code (eng-GB, fre-FR, ...)
     * @param names {Array} Multi language value (see example)
     * @return {ObjectStateGroupCreateStruct}
     * @example
     *      var objectStateGroupCreateStruct = contentService.newObjectStateGroupCreateStruct(
     *          "some-id", "eng-US", [{
     *              "_languageCode":"eng-US",
     *              "#text":"Some Name"
     *          }]
     *      );
     */
    ContentService.prototype.newObjectStateGroupCreateStruct = function (identifier, languageCode, names) {
        return new ObjectStateGroupCreateStruct(identifier, languageCode, names);
    };

    /**
     * Returns update structure for ObjectStateGroup
     *
     * @method newObjectStateGroupUpdateStruct
     * @return ObjectStateGroupUpdateStruct
     */
    ContentService.prototype.newObjectStateGroupUpdateStruct = function () {
        return new ObjectStateGroupUpdateStruct();
    };

    /**
     * Returns create structure for ObjectState
     *
     * @method newObjectStateCreateStruct
     * @param identifier {String} unique ObjectState identifier (e.g. "some-new-state")
     * @param languageCode {String} The language code (eng-GB, fre-FR, ...)
     * @param priority {int}
     * @param names {Array} Multi language value (see example)
     * @param descriptions {Array} Multi language value (see example)
     * @return {ObjectStateCreateStruct}
     * @example
     *      var objectStateCreateStruct = contentService.newObjectStateCreateStruct(
     *          "some-id", "eng-US", 0, [{
     *              "_languageCode":"eng-US",
     *              "#text":"Some Name"
     *          }], [{
     *              "_languageCode":"eng-US",
     *              "#text":"Some Description"
     *          }]
     *      );
     */
    ContentService.prototype.newObjectStateCreateStruct = function (identifier, languageCode, priority, names, descriptions) {
        return new ObjectStateCreateStruct(identifier, languageCode, priority, names, descriptions);
    };

    /**
     * Returns update structure for ObjectState
     *
     * @method newObjectStateUpdateStruct
     * @return {ObjectStateUpdateStruct}
     */
    ContentService.prototype.newObjectStateUpdateStruct = function () {
        return new ObjectStateUpdateStruct();
    };

    /**
     * Returns create structure for UrlAlias
     *
     * @method newUrlAliasCreateStruct
     * @param languageCode {String} The language code (eng-GB, fre-FR, ...)
     * @param resource {String} eZ Publish resource you want to create alias for
     * @param path {String} the new alias itself
     * @return {UrlAliasCreateStruct}
     * @example
     *     var urlAliasCreateStruct = contentService.newUrlAliasCreateStruct(
     *         "eng-US",
     *         "content/search",
     *         "findme-alias"
     *     );
     */
    ContentService.prototype.newUrlAliasCreateStruct = function (languageCode, resource, path) {
        return new UrlAliasCreateStruct(languageCode, resource, path);
    };

    /**
     * Returns create structure for UrlWildcard
     *
     * @method newUrlWildcardCreateStruct
     * @param sourceUrl {String} new url wildcard
     * @param destinationUrl {String} existing resource where wildcard should point
     * @param forward {boolean} weather or not the wildcard should redirect to the resource
     * @example
     *     var urlWildcardCreateStruct = contentService.newUrlWildcardCreateStruct(
     *         "some-new-wildcard",
     *         "/api/ezp/v2/content/locations/1/2/113",
     *         "false"
     *     );
     */
    ContentService.prototype.newUrlWildcardCreateStruct = function (sourceUrl, destinationUrl, forward) {
        return new UrlWildcardCreateStruct(sourceUrl, destinationUrl, forward);
    };

// ******************************
// Sections management
// ******************************

    /**
     * Create a new section
     *
     * @method createSection
     * @param sectionInputStruct {SectionInputStruct} object describing section to be created
     * @param callback {Function} callback executed after performing the request (see
     * {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.createSection = function (sectionInputStruct, callback) {
        var that = this;

        this._discoveryService.getInfoObject(
            "sections",
            function (error, sections) {
                if (error) {
                    callback(error, false);
                    return;
                }

                that._connectionManager.request(
                    "POST",
                    sections._href,
                    JSON.stringify(sectionInputStruct.body),
                    sectionInputStruct.headers,
                    callback
                );
            }
        );
    };

    /**
     * Update target section
     *
     * @method updateSection
     * @param sectionId {String} target section identifier (e.g. "/api/ezp/v2/content/sections/2")
     * @param sectionInputStruct {SectionInputStruct} object describing updates to the section
     * @param callback {Function} callback executed after performing the request (see
     * {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.updateSection = function (sectionId, sectionInputStruct, callback) {
        this._connectionManager.request(
            "PATCH",
            sectionId,
            JSON.stringify(sectionInputStruct.body),
            sectionInputStruct.headers,
            callback
        );
    };

    /**
     * List all available sections of eZ Publish instance
     *
     * @method loadSections
     * @param callback {Function} callback executed after performing the request (see
     * {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.loadSections = function (callback) {
        var that = this;

        this._discoveryService.getInfoObject(
            "sections",
            function (error, sections) {
                if (error) {
                    callback(error, false);
                    return;
                }

                that._connectionManager.request(
                    "GET",
                    sections._href,
                    "",
                    {"Accept": sections["_media-type"]},
                    callback
                );
            }
        );
    };

    /**
     * Load single section
     *
     * @method loadSection
     * @param sectionId {String} target section identifier (e.g. "/api/ezp/v2/content/sections/2")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.loadSection = function (sectionId, callback) {
        this._connectionManager.request(
            "GET",
            sectionId,
            "",
            {"Accept": "application/vnd.ez.api.Section+json"},
            callback
        );
    };

    /**
     * Delete target section
     *
     * @method deleteSection
     * @param sectionId {String} target section identifier (e.g. "/api/ezp/v2/content/sections/2")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.deleteSection = function (sectionId, callback) {
        this._connectionManager.delete(
            sectionId,
            callback
        );
    };

// ******************************
// Content management
// ******************************

    /**
     * Creates a new content draft assigned to the authenticated user.
     *
     * @method createContent
     * @param contentCreateStruct {ContentCreateStruct} object describing content to be created
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.createContent = function (contentCreateStruct, callback) {
        var that = this;

        this._discoveryService.getInfoObject(
            "content",
            function (error, contentObjects) {
                if (error) {
                    callback(error, false);
                    return;
                }

                that._connectionManager.request(
                    "POST",
                    contentObjects._href,
                    JSON.stringify(contentCreateStruct.body),
                    contentCreateStruct.headers,
                    callback
                );
            }
        );
    };

    /**
     * Update target content metadata.
     *
     * @method updateContentMetadata
     * @param contentId {String} target content identifier (e.g. "/api/ezp/v2/content/objects/108")
     * @param contentMetadataUpdateStruct {ContentMetadataUpdateStruct} object describing update of the content metadata
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     * @example
     *      var updateStruct = contentService.newContentMetadataUpdateStruct("eng-US");
     *
     *      updateStruct.body.ContentUpdate.Section = "/api/ezp/v2/content/sections/2";
     *      updateStruct.body.ContentUpdate.remoteId = "new-remote-id";
     *
     *      contentService.updateContentMetadata(
     *          "/api/ezp/v2/content/objects/180",
     *          updateStruct,
     *          callback
     *      );
     */
    ContentService.prototype.updateContentMetadata = function (contentId, contentMetadataUpdateStruct, callback) {
        this._connectionManager.request(
            "PATCH",
            contentId,
            JSON.stringify(contentMetadataUpdateStruct.body),
            contentMetadataUpdateStruct.headers,
            callback
        );
    };

    /**
     * Load single content by remoteId
     *
     * @method loadContentByRemoteId
     * @param remoteId {String} remote id of target content object (e.g. "30847bec12a8a398777493a4bdb10398")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.loadContentByRemoteId = function (remoteId, callback) {
        var that = this;

        this._discoveryService.getInfoObject(
            "content",
            function (error, contentObjects) {
                if (error) {
                    callback(error, false);
                    return;
                }

                that._connectionManager.request(
                    "GET",
                    contentObjects._href + '?remoteId=' + remoteId,
                    "",
                    {"Accept": contentObjects["_media-type"]},
                    callback
                );
            }
        );
    };

    /**
     * Load single content info
     *
     * @method loadContentInfo
     * @param contentId {String} target content identifier (e.g. "/api/ezp/v2/content/objects/108")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.loadContentInfo = function (contentId, callback) {
        this._connectionManager.request(
            "GET",
            contentId,
            "",
            {"Accept": "application/vnd.ez.api.ContentInfo+json"},
            callback
        );
    };

    /**
     * Load single content info with embedded current version
     *
     * @method loadContentInfoAndCurrentVersion
     * @param contentId {String} target content identifier (e.g. "/api/ezp/v2/content/objects/108")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.loadContentInfoAndCurrentVersion = function (contentId, callback) {
        this._connectionManager.request(
            "GET",
            contentId,
            "",
            {"Accept": "application/vnd.ez.api.Content+json"},
            callback
        );
    };

    /**
     * Delete target content
     *
     * @method deleteContent
     * @param contentId {String} target content identifier (e.g. "/api/ezp/v2/content/objects/108")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     * @example
     *      contentService.deleteContent(
     *          "/api/ezp/v2/content/objects/116",
     *          callback
     *      );
     */
    ContentService.prototype.deleteContent = function (contentId, callback) {
        this._connectionManager.delete(
            contentId,
            callback
        );
    };

    /**
     * Copy content to determined location
     *
     * @method copyContent
     * @param contentId {String} target content identifier (e.g. "/api/ezp/v2/content/objects/108")
     * @param destinationId {String} A location resource to which the content object should be copied (e.g. "/api/ezp/v2/content/locations/1/2/119")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.copyContent = function (contentId, destinationId, callback) {
        this._connectionManager.request(
            "COPY",
            contentId,
            "",
            {"Destination": destinationId},
            callback
        );
    };

// ******************************
// Versions management
// ******************************

    /**
     * Load current version for target content
     *
     * @method loadCurrentVersion
     * @param contentId {String} target content identifier (e.g. "/api/ezp/v2/content/objects/108")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.loadCurrentVersion = function (contentId, callback) {
        var that = this;

        this.loadContentInfo(
            contentId,
            function (error, contentResponse) {
                if (error) {
                    callback(error, false);
                    return;
                }

                var currentVersion = contentResponse.document.Content.CurrentVersion;

                that._connectionManager.request(
                    "GET",
                    currentVersion._href,
                    "",
                    {"Accept": currentVersion["_media-type"]},
                    callback
                );
            }
        );
    };

    /**
     * Loads a specific version of target content. This method returns fields and relations
     *
     * @method loadContent
     * @param versionedContentId {String} target version identifier (e.g. "/api/ezp/v2/content/objects/108/versions/2")
     * @param [fields] {String} comma separated list of fields which should be returned in the response (see Content)
     * @param [responseGroups] {String}  alternative: comma separated lists of predefined field groups (see REST API Spec v1)
     * @param [languages] {String} (comma separated list) restricts the output of translatable fields to the given languages
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     * @example
     *     contentService.loadContent(
     *          "/api/ezp/v2/content/objects/180/versions/1",
     *          null,
     *          null,
     *          "eng-US",
     *          callback
     *     );
     */
    ContentService.prototype.loadContent = function (versionedContentId, fields, responseGroups, languages, callback) {
        var defaultFields = '',
            defaultResponseGroups = '',
            defaultLanguages = '';

        // default values for omitted parameters (if any)
        if (arguments.length < 5) {
            if (typeof fields == "function") {
                //no optional parameteres are passed
                callback = fields;
                fields = defaultFields;
                responseGroups = defaultResponseGroups;
                languages = defaultLanguages;
            } else if (typeof responseGroups == "function") {
                // only first 1 optional parameter is passed
                callback = responseGroups;
                responseGroups = defaultResponseGroups;
                languages = defaultLanguages;
            } else {
                // only first 2 optional parameters are passed
                callback = languages;
                languages = defaultLanguages;
            }
        }

        if (fields) {
            fields = '?fields=' + fields;
        }
        if (responseGroups) {
            responseGroups = '&responseGroups="' + responseGroups + '"';
        }
        if (languages) {
            languages = '&languages=' + languages;
        }

        this._connectionManager.request(
            "GET",
            versionedContentId + fields + responseGroups + languages,
            "",
            {"Accept": "application/vnd.ez.api.Version+json"},
            callback
        );
    };

    /**
     *  Loads all versions for the target content
     *
     * @method loadVersions
     * @param contentId {String} target content identifier (e.g. "/api/ezp/v2/content/objects/108")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.loadVersions = function (contentId, callback) {
        var that = this;

        this.loadContentInfo(
            contentId,
            function (error, contentResponse) {
                if (error) {
                    callback(error, false);
                    return;
                }

                var contentVersions = contentResponse.document.Content.Versions;

                that._connectionManager.request(
                    "GET",
                    contentVersions._href,
                    "",
                    {"Accept": contentVersions["_media-type"]},
                    callback
                );
            }
        );
    };

    /**
     * Updates the fields of a target draft
     *
     * @method updateContent
     * @param versionedContentId {String} target version identifier (e.g. "/api/ezp/v2/content/objects/108/versions/2")
     * @param contentUpdateStruct {ContentUpdateStruct} object describing update to the draft
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.updateContent = function (versionedContentId, contentUpdateStruct, callback) {
        this._connectionManager.request(
            "PATCH",
            versionedContentId,
            JSON.stringify(contentUpdateStruct.body),
            contentUpdateStruct.headers,
            callback
        );
    };

    /**
     * Creates a draft from a published or archived version.
     *
     * @method createContentDraft
     * @param contentId {String} target content identifier (e.g. "/api/ezp/v2/content/objects/108")
     * @param [versionId] {int} numerical id of the base version for the new draft. If not provided the current version of the content will be used.
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     * @example
     *      // Create draft from current version
     *      contentService.createContentDraft(
     *          "/api/ezp/v2/content/objects/107",
     *          null,
     *          callback
     *      );
     *
     *      // Create draft from version #2
     *      contentService.createContentDraft(
     *          "/api/ezp/v2/content/objects/107",
     *          2,
     *          callback
     *      );
     */
    ContentService.prototype.createContentDraft = function (contentId, versionId, callback) {
        var that = this;

        this.loadContentInfo(
            contentId,
            function (error, contentResponse) {
                var url = '';

                if (error) {
                    callback(error, false);
                    return;
                }

                if (typeof versionId !== "function") {
                    url = contentResponse.document.Content.Versions._href + "/" + versionId;
                } else {
                    callback = versionId;
                    url = contentResponse.document.Content.CurrentVersion._href;
                }

                that._connectionManager.request(
                    "COPY", url, "",
                    {"Accept": "application/vnd.ez.api.Version+json"},
                    callback
                );
            }
        );
    };

    /**
     * Deletes target version of the content.
     *
     * @method deleteVersion
     * @param versionedContentId {String} target version identifier (e.g. "/api/ezp/v2/content/objects/108/versions/2")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.deleteVersion = function (versionedContentId, callback) {
        this._connectionManager.delete(
            versionedContentId,
            callback
        );
    };

    /**
     * Publishes target version of the content.
     *
     * @method publishVersion
     * @param versionedContentId {String} target version identifier (e.g. "/api/ezp/v2/content/objects/108/versions/2")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.publishVersion = function (versionedContentId, callback) {
        this._connectionManager.request(
            "PUBLISH",
            versionedContentId,
            "",
            {},
            callback
        );
    };

// ******************************
// Locations management
// ******************************

    /**
     * Creates a new location for target content object
     *
     * @method createLocation
     * @param contentId {String} target content identifier (e.g. "/api/ezp/v2/content/objects/108")
     * @param locationCreateStruct {LocationCreateStruct} object describing new location to be created
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.createLocation = function (contentId, locationCreateStruct, callback) {
        var that = this;

        this.loadContentInfo(
            contentId,
            function (error, contentResponse) {
                if (error) {
                    callback(error, false);
                    return;
                }

                var locations = contentResponse.document.Content.Locations;

                that._connectionManager.request(
                    "POST",
                    locations._href,
                    JSON.stringify(locationCreateStruct.body),
                    locationCreateStruct.headers,
                    callback
                );
            }
        );
    };

    /**
     *  Loads all locations for target content object
     *
     * @method loadLocations
     * @param contentId {String} target content identifier (e.g. "/api/ezp/v2/content/objects/108")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.loadLocations = function (contentId, callback) {
        var that = this;

        this.loadContentInfo(
            contentId,
            function (error, contentResponse) {
                if (error) {
                    callback(error, false);
                    return;
                }

                var locations = contentResponse.document.Content.Locations;

                that._connectionManager.request(
                    "GET",
                    locations._href,
                    "",
                    {"Accept": "application/vnd.ez.api.LocationList+json"},
                    callback
                );
            }
        );
    };

    /**
     *  Loads target location
     *
     * @method loadLocation
     * @param locationId {String} target location identifier (e.g. "/api/ezp/v2/content/locations/1/2/102")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.loadLocation = function (locationId, callback) {
        this._connectionManager.request(
            "GET",
            locationId,
            "",
            {"Accept": "application/vnd.ez.api.Location+json"},
            callback
        );
    };

    /**
     *  Loads target location by remote Id
     *
     * @method loadLocationByRemoteId
     * @param locations {String} root locations (will be auto-discovered in near future)
     * @param remoteId {String} remote id of target location (e.g. "0bae96bd419e141ff3200ccbf2822e4f")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.loadLocationByRemoteId = function (locations, remoteId, callback) {
        this._connectionManager.request(
            "GET",
            locations + '?remoteId=' + remoteId,
            "",
            {Accept: "application/vnd.ez.api.Location+json"},
            callback
        );
    };

    /**
     * Updates target location
     *
     * @method updateLocation
     * @param locationId {String} target location identifier (e.g. "/api/ezp/v2/content/locations/1/2/102")
     * @param locationUpdateStruct {LocationUpdateStruct} object describing changes to target location
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.updateLocation = function (locationId, locationUpdateStruct, callback) {
        this._connectionManager.request(
            "PATCH",
            locationId,
            JSON.stringify(locationUpdateStruct.body),
            locationUpdateStruct.headers,
            callback
        );
    };

    /**
     *  Loads children for the target location
     *
     * @method loadLocationChildren
     * @param locationId {String} target location identifier (e.g. "/api/ezp/v2/content/locations/1/2/102")
     * @param [limit=-1] {int} the number of results returned
     * @param [offset=0] {int} the offset of the result set
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     * @example
     *      contentService.loadLocationChildren(
     *          "/api/ezp/v2/content/locations/1/2/102",
     *          5,
     *          5,
     *          callback
     *      );
     */
    ContentService.prototype.loadLocationChildren = function (locationId, limit, offset, callback) {

        var that = this,
            defaultLimit = -1,
            defaultOffset = 0;

        // default values for omitted parameters (if any)
        if (arguments.length < 4) {
            if (typeof limit == "function") {
                // no optional params are passed
                callback = limit;
                limit = defaultLimit;
                offset = defaultOffset;
            } else {
                // only limit is passed
                callback = offset;
                offset = defaultOffset;
            }
        }

        this.loadLocation(
            locationId,
            function (error, locationResponse) {
                if (error) {
                    callback(error, false);
                    return;
                }

                var location = locationResponse.document.Location;

                that._connectionManager.request(
                    "GET",
                    location.Children._href + '?offset=' + offset + '&limit=' + limit,
                    "",
                    {"Accept": location.Children["_media-type"]},
                    callback
                );
            }
        );
    };

    /**
     *  Copies the subtree starting from "subtree" as a new subtree of "targetLocation"
     *
     * @method copySubtree
     * @param subtree {String} source subtree location
     * @param targetLocation {String} location where source subtree should be copied
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.copySubtree = function (subtree, targetLocation, callback) {
        this._connectionManager.request(
            "COPY",
            subtree,
            "",
            {"Destination": targetLocation},
            callback
        );
    };

    /**
     *  Moves the subtree to a new subtree of "targetLocation"
     *  The targetLocation can also be /content/trash, in that case the location is put into the trash.
     *
     * @method moveSubtree
     * @param subtree {String} source subtree location
     * @param targetLocation {String} location where source subtree should be moved
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.moveSubtree = function (subtree, targetLocation, callback) {
        this._connectionManager.request(
            "MOVE",
            subtree,
            "",
            {"Destination": targetLocation},
            callback
        );
    };

    /**
     *  Swaps the location of the "subtree" with "targetLocation"
     *
     * @method swapLocation
     * @param subtree {String} source subtree location
     * @param targetLocation {String} location with which subtree location should be swapped
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.swapLocation = function (subtree, targetLocation, callback) {
        this._connectionManager.request(
            "SWAP",
            subtree,
            "",
            {"Destination": targetLocation},
            callback
        );
    };

    /**
     *  Deletes the location and all it's subtrees
     *  Every content object is deleted which does not have any other location.
     *  Otherwise the deleted location is removed from the content object.
     *  The children are recursively deleted.
     *
     * @method deleteLocation
     * @param locationId {String} target location identifier (e.g. "/api/ezp/v2/content/locations/1/2/102")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.deleteLocation = function (locationId, callback) {
        this._connectionManager.delete(
            locationId,
            callback
        );
    };

// ******************************
// Views management
// ******************************

    /**
     * Creates a new view. Views are used to perform content queries by certain criteria.
     *
     * @method createView
     * @param viewCreateStruct {ViewCreateStruct} object describing new view to be created
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     * @example
     *     var viewCreateStruct = contentService.newViewCreateStruct('some-test-id');
     *     viewCreateStruct.body.ViewInput.Query.Criteria = {
     *         FullTextCriterion : "title"
     *     };
     *     contentService.createView(
     *         viewCreateStruct,
     *         callback
     *     );
     */
    ContentService.prototype.createView = function (viewCreateStruct, callback) {
        var that = this;

        this._discoveryService.getInfoObject(
            "views",
            function (error, views) {
                if (error) {
                    callback(error, false);
                    return;
                }

                that._connectionManager.request(
                    "POST",
                    views._href,
                    JSON.stringify(viewCreateStruct.body),
                    viewCreateStruct.headers,
                    callback
                );
            }
        );
    };

// ******************************
// Relations management
// ******************************

    /**
     *  Loads the relations of the target version.
     *
     * @method loadRelations
     * @param versionedContentId {String} target version identifier (e.g. "/api/ezp/v2/content/objects/108/versions/2")
     * @param [limit=-1] {int} the number of results returned
     * @param [offset=0] {int} the offset of the result set
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     * @example
     *      //See loadLocationChildren for example of "offset" and "limit" arguments usage
     */
    ContentService.prototype.loadRelations = function (versionedContentId, limit, offset, callback) {

        var that = this,
            defaultLimit = -1,
            defaultOffset = 0;

        // default values for omitted parameters (if any)
        if (arguments.length < 4) {
            if (typeof limit == "function") {
                // no optional params are passed
                callback = limit;
                limit = defaultLimit;
                offset = defaultOffset;
            } else {
                // only limit is passed
                callback = offset;
                offset = defaultOffset;
            }
        }

        this.loadContent(
            versionedContentId,
            {},
            function (error, versionResponse) {
                if (error) {
                    callback(error, false);
                    return;
                }

                var version = versionResponse.document.Version;

                that._connectionManager.request(
                    "GET",
                    version.Relations._href + '?offset=' + offset + '&limit=' + limit,
                    "",
                    {"Accept": version.Relations["_media-type"]},
                    callback
                );
            }
        );
    };

    /**
     *  Loads the relations of the target content's current version
     *
     * @method loadCurrentRelations
     * @param contentId {String} target content identifier (e.g. "/api/ezp/v2/content/objects/102")
     * @param [limit=-1] {int} the number of results returned
     * @param [offset=0] {int} the offset of the result set
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     * @example
     *      //See loadLocationChildren for example of "offset" and "limit" arguments usage
     */
    ContentService.prototype.loadCurrentRelations = function (contentId, limit, offset, callback) {

        var that = this,
            defaultLimit = -1,
            defaultOffset = 0;

        // default values for omitted parameters (if any)
        if (arguments.length < 4) {
            if (typeof limit == "function") {
                // no optional params are passed
                callback = limit;
                limit = defaultLimit;
                offset = defaultOffset;
            } else {
                // only limit is passed
                callback = offset;
                offset = defaultOffset;
            }
        }

        this.loadCurrentVersion(
            contentId,
            function (error, currentVersionResponse) {
                if (error) {
                    callback(error, false);
                    return;
                }

                var currentVersion = currentVersionResponse.document.Version;

                that._connectionManager.request(
                    "GET",
                    currentVersion.Relations._href + '?offset=' + offset + '&limit=' + limit,
                    "",
                    {"Accept": currentVersion.Relations["_media-type"]},
                    callback
                );
            }
        );
    };

    /**
     *  Loads target relation
     *
     * @method loadRelation
     * @param relationId {String} target relation identifier (e.g. "/api/ezp/v2/content/objects/102/versions/5/relations/1")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.loadRelation = function (relationId, callback) {
        this._connectionManager.request(
            "GET",
            relationId,
            "",
            {"Accept": "application/vnd.ez.api.Relation+json"},
            callback
        );
    };

    /**
     *  Creates a new relation of type COMMON for the given draft.
     *
     * @method addRelation
     * @param versionedContentId {String} target version identifier (e.g. "/api/ezp/v2/content/objects/102/versions/5")
     * @param relationCreateStruct {RelationCreateStruct} object describing new relation to be created
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     * @example
     *      var relationCreateStruct = contentService.newRelationCreateStruct("/api/ezp/v2/content/objects/132");
     *      contentService.addRelation(
     *          "/api/ezp/v2/content/objects/102/versions/5",
     *          relationCreateStruct,
     *          callback
     *      );
     */
    ContentService.prototype.addRelation = function (versionedContentId, relationCreateStruct, callback) {
        var that = this;

        this.loadContent(
            versionedContentId,
            {},
            function (error, versionResponse) {
                if (error) {
                    callback(error, false);
                    return;
                }

                var version = versionResponse.document.Version;

                that._connectionManager.request(
                    "POST",
                    version.Relations._href,
                    JSON.stringify(relationCreateStruct.body),
                    relationCreateStruct.headers,
                    callback
                );
            }
        );
    };

    /**
     *  Delete target relation
     *
     * @method deleteRelation
     * @param relationId {String} target relation identifier (e.g. "/api/ezp/v2/content/objects/102/versions/5/relations/1")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.deleteRelation = function (relationId, callback) {
        this._connectionManager.delete(
            relationId,
            callback
        );
    };

// ******************************
// Thrash management
// ******************************

    /**
     *  Loads all the thrash can items
     *
     * @method loadTrashItems
     * @param [limit=-1] {int} the number of results returned
     * @param [offset=0] {int} the offset of the result set
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     * @example
     *      //See loadLocationChildren for example of "offset" and "limit" arguments usage
     */
    ContentService.prototype.loadTrashItems = function (limit, offset, callback) {

        var that = this,
            defaultLimit = -1,
            defaultOffset = 0;

        // default values for omitted parameters (if any)
        if (arguments.length < 3) {
            if (typeof limit == "function") {
                // no optional params are passed
                callback = limit;
                limit = defaultLimit;
                offset = defaultOffset;
            } else {
                // only limit is passed
                callback = offset;
                offset = defaultOffset;
            }
        }

        this._discoveryService.getInfoObject(
            "trash",
            function (error, trash) {
                if (error) {
                    callback(error, false);
                    return;
                }

                that._connectionManager.request(
                    "GET",
                    trash._href + '?offset=' + offset + '&limit=' + limit,
                    "",
                    {"Accept": trash["_media-type"]},
                    callback
                );
            }
        );
    };

    /**
     *  Loads target thrash can item
     *
     * @method loadTrashItem
     * @param trashItemId {String} target trash item identifier (e.g. "/api/ezp/v2/content/trash/1")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.loadTrashItem = function (trashItemId, callback) {
        this._connectionManager.request(
            "GET",
            trashItemId,
            "",
            {"Accept": "application/vnd.ez.api.TrashItem+json"},
            callback
        );
    };

    /**
     *  Restores target trashItem
     *
     * @method recover
     * @param trashItemId {String} target trash item identifier (e.g. "/api/ezp/v2/content/trash/1")
     * @param [destination] {String} if given the trash item is restored under this location otherwise under its original parent location
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.recover = function (trashItemId, destination, callback) {

        var headers = {"Accept": "application/vnd.ez.api.TrashItem+json"};

        if ((typeof destination != "function")) {
            headers.Destination = destination;
        } else {
            callback = destination;
        }

        this._connectionManager.request(
            "MOVE",
            trashItemId,
            "",
            headers,
            callback
        );
    };

    /**
     *  Delete target trashItem
     *
     * @method deleteTrashItem
     * @param trashItemId {String} target trash item identifier (e.g. "/api/ezp/v2/content/trash/1")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.deleteTrashItem = function (trashItemId, callback) {
        this._connectionManager.delete(
            trashItemId,
            callback
        );
    };

    /**
     *  Empty the trash can
     *
     * @method emptyThrash
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.emptyThrash = function (callback) {
        var that = this;

        this._discoveryService.getInfoObject(
            "trash",
            function (error, trash) {
                if (error) {
                    callback(error, false);
                    return;
                }

                that._connectionManager.request(
                    "DELETE",
                    trash._href,
                    "",
                    {},
                    callback
                );
            }
        );
    };

// ******************************
// ObjectStates management
// ******************************

    /**
     *  Loads all the ObjectState groups
     *
     * @method loadObjectStateGroups
     * @param objectStateGroups {String} path to root objectStateGroups (will be replaced by auto-discovered soon)
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.loadObjectStateGroups = function (objectStateGroups, callback) {
        this._connectionManager.request(
            "GET",
            objectStateGroups,
            "",
            {"Accept": "application/vnd.ez.api.ObjectStateGroupList+json"},
            callback
        );
    };

    /**
     *  Loads target ObjectState group
     *
     * @method loadObjectStateGroup
     * @param objectStateGroupId {String} target object state group identifier (e.g. "/api/ezp/v2/content/objectstategroups/2")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.loadObjectStateGroup = function (objectStateGroupId, callback) {
        this._connectionManager.request(
            "GET",
            objectStateGroupId,
            "",
            {"Accept": "application/vnd.ez.api.ObjectStateGroup+json"},
            callback
        );
    };

    /**
     *  Create a new ObjectState group
     *
     * @method createObjectStateGroup
     * @param objectStateGroups {String} path to root objectStateGroups (will be replaced by auto-discovered soon)
     * @param objectStateGroupCreateStruct {ObjectStateGroupCreateStruct} object describing new ObjectState group to be created
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.createObjectStateGroup = function (objectStateGroups, objectStateGroupCreateStruct, callback) {
        this._connectionManager.request(
            "POST",
            objectStateGroups,
            JSON.stringify(objectStateGroupCreateStruct.body),
            objectStateGroupCreateStruct.headers,
            callback
        );
    };

    /**
     *  Update target ObjectState group
     *
     * @method updateObjectStateGroup
     * @param objectStateGroupId {String} target object state group identifier (e.g. "/api/ezp/v2/content/objectstategroups/2")
     * @param objectStateGroupUpdateStruct {ObjectStateGroupUpdateStruct} object describing changes to target ObjectState group
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.updateObjectStateGroup = function (objectStateGroupId, objectStateGroupUpdateStruct, callback) {
        this._connectionManager.request(
            "PATCH",
            objectStateGroupId,
            JSON.stringify(objectStateGroupUpdateStruct.body),
            objectStateGroupUpdateStruct.headers,
            callback
        );
    };

    /**
     *  Delete target ObjectState group
     *
     * @method deleteObjectStateGroup
     * @param objectStateGroupId {String} target object state group identifier (e.g. "/api/ezp/v2/content/objectstategroups/2")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.deleteObjectStateGroup = function (objectStateGroupId, callback) {
        this._connectionManager.delete(
            objectStateGroupId,
            callback
        );
    };

    /**
     *  Creates a new ObjectState in target group
     *
     * @method createObjectState
     * @param objectStateGroupId {String} target group, where new object state should be created (e.g. "/api/ezp/v2/content/objectstategroups/2")
     * @param objectStateCreateStruct {ObjectStateCreateStruct} object describing new ObjectState to be created
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.createObjectState = function (objectStateGroupId, objectStateCreateStruct, callback) {
        this._connectionManager.request(
            "POST",
            objectStateGroupId + "/objectstates",
            JSON.stringify(objectStateCreateStruct.body),
            objectStateCreateStruct.headers,
            callback
        );
    };

    /**
     *  Load target ObjectState
     *
     * @method loadObjectState
     * @param objectStateId {String} target object state identifier (e.g. "/api/ezp/v2/content/objectstategroups/7/objectstates/5")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.loadObjectState = function (objectStateId, callback) {
        this._connectionManager.request(
            "GET",
            objectStateId,
            "",
            {"Accept": "application/vnd.ez.api.ObjectState+json"},
            callback
        );
    };

    /**
     *  Update target ObjectState
     *
     * @method updateObjectState
     * @param objectStateId {String} target object state identifier (e.g. "/api/ezp/v2/content/objectstategroups/7/objectstates/5")
     * @param objectStateUpdateStruct {ObjectStateUpdateStruct} object describing changes to target ObjectState
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.updateObjectState = function (objectStateId, objectStateUpdateStruct, callback) {
        this._connectionManager.request(
            "PATCH",
            objectStateId,
            JSON.stringify(objectStateUpdateStruct.body),
            objectStateUpdateStruct.headers,
            callback
        );
    };

    /**
     *  Delete target ObjectState
     *
     * @method deleteObjectState
     * @param objectStateId {String} target object state identifier (e.g. "/api/ezp/v2/content/objectstategroups/7/objectstates/5")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.deleteObjectState = function (objectStateId, callback) {
        this._connectionManager.delete(
            objectStateId,
            callback
        );
    };

    /**
     *  Get ObjectStates of target content
     *
     * @method getContentState
     * @param contentStatesId {String} link to target content's object states (should be auto-discovered from contentId)
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.getContentState = function (contentStatesId, callback) {
        this._connectionManager.request(
            "GET",
            contentStatesId,
            "",
            {"Accept": "application/vnd.ez.api.ContentObjectStates+json"},
            callback
        );
    };

    /**
     *  Set ObjectStates of a content
     *
     * @method setContentState
     * @param contentStatesId {String} link to target content's object states (should be auto-discovered from contentId)
     * @param objectStates {Array}
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     * @example
     *     contentService.loadObjectState(
     *          "/api/ezp/v2/content/objectstategroups/4/objectstates/3",
     *          function (error, objectStateResponse) {
     *              // possible error should be handled...
     *
     *              var objectStates = {};
     *              // Extra odd structure, but it works!
     *              objectStates.ObjectState = {};
     *              objectStates.ObjectState.ObjectState = {};
     *              objectStates.ObjectState.ObjectState = JSON.parse(objectStateResponse.body);
     *
     *              contentService.setContentState(
     *                  "/api/ezp/v2/content/objects/17/objectstates",
     *                  objectStates,
     *                  callback
     *              );
     *          }
     *     );
     */
    ContentService.prototype.setContentState = function (contentStatesId, objectStates, callback) {
        this._connectionManager.request(
            "PATCH",
            contentStatesId,
            JSON.stringify(objectStates),
            {
                "Accept": "application/vnd.ez.api.ContentObjectStates+json",
                "Content-Type": "application/vnd.ez.api.ContentObjectStates+json"
            },
            callback
        );
    };

// ******************************
// URL Aliases management
// ******************************

    /**
     *  Creates a new UrlAlias
     *
     * @method createUrlAlias
     * @param urlAliases {String} link to root UrlAliases resource (should be auto-discovered)
     * @param urlAliasCreateStruct {UrlAliasCreateStruct} object describing new UrlAlias to be created
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.createUrlAlias = function (urlAliases, urlAliasCreateStruct, callback) {
        this._connectionManager.request(
            "POST",
            urlAliases,
            JSON.stringify(urlAliasCreateStruct.body),
            urlAliasCreateStruct.headers,
            callback
        );
    };

    /**
     *  Loads all the global UrlAliases
     *
     * @method loadUrlAliases
     * @param urlAliases {String} link to root UrlAliases resource (should be auto-discovered)
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.listGlobalAliases = function (urlAliases, callback) {
        this._connectionManager.request(
            "GET",
            urlAliases,
            "",
            {"Accept": "application/vnd.ez.api.UrlAliasRefList+json"},
            callback
        );
    };

    /**
     *  Loads all the UrlAliases for a location
     *
     * @method listLocationAliases
     * @param locationUrlAliases {String} link to target location's UrlAliases (should be auto-discovered from locationId)
     * @param [custom=true] {boolean} this flag indicates weather autogenerated (false) or manual url aliases (true) should be returned
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.listLocationAliases = function (locationUrlAliases, custom, callback) {

        var parameters;

        // default values for omitted parameters (if any)
        if (arguments.length < 3) {
            callback = custom;
            custom = true;
        }

        parameters = (custom === true) ? "" : "?custom=false";

        this._connectionManager.request(
            "GET",
            locationUrlAliases + '/urlaliases' + parameters,
            "",
            {"Accept": "application/vnd.ez.api.UrlAliasRefList+json"},
            callback
        );
    };

    /**
     *  Load target URL Alias
     *
     * @method loadUrlAlias
     * @param urlAliasId {String} target url alias identifier (e.g. "/api/ezp/v2/content/urlaliases/0-a903c03b86eb2987889afa5fe17004eb")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.loadUrlAlias = function (urlAliasId, callback) {
        this._connectionManager.request(
            "GET",
            urlAliasId,
            "",
            {"Accept": "application/vnd.ez.api.UrlAlias+json"},
            callback
        );
    };

    /**
     *  Delete target URL Alias
     *
     * @method deleteUrlAlias
     * @param urlAliasId {String} target url alias identifier (e.g. "/api/ezp/v2/content/urlaliases/0-a903c03b86eb2987889afa5fe17004eb")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.deleteUrlAlias = function (urlAliasId, callback) {
        this._connectionManager.delete(
            urlAliasId,
            callback
        );
    };

// ******************************
// URL Wildcards management
// ******************************

    /**
     *  Creates a new UrlWildcard
     *
     * @method createUrlWildcard
     * @param urlWildcards {String} link to root UrlWildcards resource (should be auto-discovered)
     * @param urlWildcardCreateStruct {UrlWildcardCreateStruct} object describing new UrlWildcard to be created
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.createUrlWildcard = function (urlWildcards, urlWildcardCreateStruct, callback) {
        this._connectionManager.request(
            "POST",
            urlWildcards,
            JSON.stringify(urlWildcardCreateStruct.body),
            urlWildcardCreateStruct.headers,
            callback
        );
    };

    /**
     *  Loads all UrlWildcards
     *
     * @method loadUrlWildcards
     * @param urlWildcards {String} link to root UrlWildcards resource (should be auto-discovered)
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.loadUrlWildcards = function (urlWildcards, callback) {
        this._connectionManager.request(
            "GET",
            urlWildcards,
            "",
            {"Accept": "application/vnd.ez.api.UrlWildcardList+json"},
            callback
        );
    };

    /**
     *  Loads target UrlWildcard
     *
     * @method loadUrlWildcard
     * @param urlWildcardId {String} target url wildcard identifier (e.g. "/api/ezp/v2/content/urlwildcards/1")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.loadUrlWildcard = function (urlWildcardId, callback) {
        this._connectionManager.request(
            "GET",
            urlWildcardId,
            "",
            {"Accept": "application/vnd.ez.api.UrlWildcard+json"},
            callback
        );
    };

    /**
     *  Deletes target UrlWildcard
     *
     * @method deleteUrlWildcard
     * @param urlWildcardId {String} target url wildcard identifier (e.g. "/api/ezp/v2/content/urlwildcards/1")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentService.prototype.deleteUrlWildcard = function (urlWildcardId, callback) {
        this._connectionManager.delete(
            urlWildcardId,
            callback
        );
    };

    return ContentService;

});

/* global define */
define('structures/ContentTypeGroupInputStruct',[],function () {
    

    /**
     * Returns a structure used to create and update a Content Type group. See
     * {{#crossLink "ContentTypeService/createContentTypeGroup"}}ContentTypeService.createContentTypeGroup{{/crossLink}}
     *
     * @class ContentTypeGroupInputStruct
     * @constructor
     * @param identifier {String} Unique identifier for the target Content Type group (e.g. "my_new_content_type_group")
     */
    var ContentTypeGroupInputStruct = function (identifier) {
        this.body = {};
        this.body.ContentTypeGroupInput = {};

        this.body.ContentTypeGroupInput.identifier = identifier;

        this.headers = {};
        this.headers.Accept = "application/vnd.ez.api.ContentTypeGroup+json";
        this.headers["Content-Type"] = "application/vnd.ez.api.ContentTypeGroupInput+json";

        return this;
    };

    return ContentTypeGroupInputStruct;

});
/* global define */
define('structures/ContentTypeCreateStruct',[],function () {
    

    /**
     * Returns a structure used to create a new Content Type object. See
     * {{#crossLink "ContentTypeService/createContentType"}}ContentTypeService.createContentType{{/crossLink}}
     *
     * @class ContentTypeCreateStruct
     * @constructor
     * @param identifier {String} Unique identifier for the target Content Type (e.g. "my_new_content_type")
     * @param languageCode {String} The language code (e.g. "eng-GB")
     * @param names {Array} Multi language value (see example in
     * {{#crossLink "ContentTypeService/newContentTypeCreateStruct"}}ContentTypeService:newContentTypeCreateStruct{{/crossLink}})
     */
    var ContentTypeCreateStruct = function (identifier, languageCode, names) {
        var now = JSON.parse(JSON.stringify(new Date()));

        this.body = {};
        this.body.ContentTypeCreate = {};

        this.body.ContentTypeCreate.identifier = identifier;

        this.body.ContentTypeCreate.names = {};
        this.body.ContentTypeCreate.names.value = names;

        this.body.ContentTypeCreate.nameSchema = "&lt;title&gt;";
        this.body.ContentTypeCreate.urlAliasSchema = "&lt;title&gt;";

        this.body.ContentTypeCreate.remoteId = null;
        this.body.ContentTypeCreate.mainLanguageCode = languageCode;
        this.body.ContentTypeCreate.isContainer = "true";
        this.body.ContentTypeCreate.modificationDate = now;

        this.body.ContentTypeCreate.defalutAlwaysAvailable = "true";
        this.body.ContentTypeCreate.defalutSortField = "PATH";
        this.body.ContentTypeCreate.defalutSortOrder = "ASC";

        this.body.ContentTypeCreate.FieldDefinitions = {};
        this.body.ContentTypeCreate.FieldDefinitions.FieldDefinition = [];

        this.headers = {};
        this.headers.Accept = "application/vnd.ez.api.ContentType+json";
        this.headers["Content-Type"] = "application/vnd.ez.api.ContentTypeCreate+json";

        return this;
    };

    return ContentTypeCreateStruct;

});
/* global define */
define('structures/ContentTypeUpdateStruct',[],function () {
    

    /**
     * Returns a structure used to update a Content Type object. See for ex.
     * {{#crossLink "ContentTypeService/createContentTypeDraft"}}ContentTypeService.createContentTypeDraft{{/crossLink}}
     *
     * @class ContentTypeUpdateStruct
     * @constructor
     */
    var ContentTypeUpdateStruct = function () {
        this.body = {};
        this.body.ContentTypeUpdate = {};

        this.headers = {};
        this.headers.Accept = "application/vnd.ez.api.ContentType+json";
        this.headers["Content-Type"] = "application/vnd.ez.api.ContentTypeUpdate+json";

        return this;
    };

    return ContentTypeUpdateStruct;

});
/* global define */
define('structures/FieldDefinitionCreateStruct',[],function () {
    

    /**
     * Returns a structure used to create a new Field Definition. See
     * {{#crossLink "ContentTypeService/addFieldDefinition"}}ContentTypeService.addFieldDefinition{{/crossLink}}
     *
     * @class FieldDefinitionCreateStruct
     * @constructor
     * @param identifier {String} unique field definiton identifer (e.g. "my-field")
     * @param fieldType {String} identifier of existing field type (e.g. "ezstring", "ezdate")
     * @param fieldGroup {String} identifier of existing field group (e.g. "content", "meta")
     * @param names {Array} Multi language value (see example in
     * {{#crossLink "ContentTypeService/newFieldDefinitionCreateStruct"}}ContentTypeService.newFieldDefintionCreateStruct{{/crossLink}})
     */
    var FieldDefinitionCreateStruct = function (identifier, fieldType, fieldGroup, names) {
        this.body = {};
        this.body.FieldDefinitionCreate = {};

        this.body.FieldDefinitionCreate.identifier = identifier;
        this.body.FieldDefinitionCreate.fieldType = fieldType;
        this.body.FieldDefinitionCreate.fieldGroup = fieldGroup;
        this.body.FieldDefinitionCreate.position = 1;

        this.body.FieldDefinitionCreate.isTranslatable = "true";
        this.body.FieldDefinitionCreate.isRequired = "false";
        this.body.FieldDefinitionCreate.isInfoCollector = "false";
        this.body.FieldDefinitionCreate.isSearchable = "false";

        this.body.FieldDefinitionCreate.defaultValue = "false";
        //TODO: find out which can be commented out

        this.body.FieldDefinitionCreate.names = {};
        this.body.FieldDefinitionCreate.names.value = names;

        this.body.FieldDefinitionCreate.descriptions = {};
        this.body.FieldDefinitionCreate.descriptions.value = [];

        this.headers = {};
        this.headers.Accept = "application/vnd.ez.api.FieldDefinition+json";
        this.headers["Content-Type"] = "application/vnd.ez.api.FieldDefinitionCreate+json";

        return this;
    };

    return FieldDefinitionCreateStruct;

});
/* global define */
define('structures/FieldDefinitionUpdateStruct',[],function () {
    

    /**
     * Returns a structure used to update a Field Definition. See
     * {{#crossLink "ContentTypeService/updateFieldDefinition"}}ContentTypeService.updateFieldDefinition{{/crossLink}}
     *
     * @class FieldDefinitionUpdateStruct
     * @constructor
     */
    var FieldDefinitionUpdateStruct = function () {
        this.body = {};
        this.body.FieldDefinitionUpdate = {};

        this.headers = {};
        this.headers.Accept = "application/vnd.ez.api.FieldDefinition+json";
        this.headers["Content-Type"] = "application/vnd.ez.api.FieldDefinitionUpdate+json";

        return this;
    };

    return FieldDefinitionUpdateStruct;

});
/* global define */
define('services/ContentTypeService',["structures/ContentTypeGroupInputStruct", "structures/ContentTypeCreateStruct", "structures/ContentTypeUpdateStruct",
        "structures/FieldDefinitionCreateStruct", "structures/FieldDefinitionUpdateStruct"],
    function (ContentTypeGroupInputStruct, ContentTypeCreateStruct, ContentTypeUpdateStruct,
              FieldDefinitionCreateStruct, FieldDefinitionUpdateStruct) {
    

    /**
     * Creates an instance of content type service object. Should be retrieved from CAPI instance (see example).
     *
     * ## Note on the *callbacks* usage
     *
     * The **callback** argument of the service methods always take 2 arguments:
     *
     *    *     **error** either `false` or {{#crossLink "CAPIError"}}CAPIError{{/crossLink}} object when an error occurred
     *
     *    *     **response** the {{#crossLink "Response"}}Response{{/crossLink}} object
     *
     * Example:
     *
     *     var contentTypeGroupCreateStruct = contentTypeService.newContentTypeGroupInputStruct(
     *         "new-group-id"
     *     );
     *
     *     contentTypeService..createContentTypeGroup(
     *         "/api/ezp/v2/content/typegroups",
     *         contentTypeGroupCreateStruct,
     *         function (error, response) {
     *            if (error) {
     *                console.log('An error occurred', error);
     *            } else {
     *                console.log('Success!', response);
     *            }
     *     });
     *
     * @class ContentTypeService
     * @constructor
     * @param connectionManager {ConnectionManager} connection manager that will be used to send requests to REST service
     * @param discoveryService {DiscoveryService} discovery service is used for urls auto-discovery automation
     * @example
     *     var contentTypeService = jsCAPI.getContentTypeService();
     */
    var ContentTypeService = function (connectionManager, discoveryService) {
        this._connectionManager = connectionManager;
        this._discoveryService = discoveryService;
    };

// ******************************
// Structures
// ******************************

    /**
     * Returns content type group create structure
     *
     * @method newContentTypeGroupInputStruct
     * @param identifier {String} unique content type group identifer (e.g. "my-group")
     * @return {ContentTypeGroupInputStruct}
     */
    ContentTypeService.prototype.newContentTypeGroupInputStruct = function (identifier) {
        return new ContentTypeGroupInputStruct(identifier);
    };

    /**
     * @method newContentTypeCreateStruct
     * @param identifier {String} unique content type identifer (e.g. "my-type")
     * @param languageCode {String} The language code (eng-GB, fre-FR, ...)
     * @param names {Array} Multi language value (see example)
     * @return {ContentTypeCreateStruct}
     * @example
     *      var contentTypeCreateStruct = contentTypeService.newContentTypeCreateStruct(
     *          "some-id", "eng-US", [{
     *              "_languageCode":"eng-US",
     *              "#text":"Some Name"
     *          }]
     *      );
     */
    ContentTypeService.prototype.newContentTypeCreateStruct = function (identifier, languageCode, names) {
        return new ContentTypeCreateStruct(identifier, languageCode, names);
    };

    /**
     * @method newContentTypeUpdateStruct
     * @return {ContentTypeUpdateStruct}
     */
    ContentTypeService.prototype.newContentTypeUpdateStruct = function () {
        return new ContentTypeUpdateStruct();
    };

    /**
     * @method newFieldDefinitionCreateStruct
     * @param identifier {String} unique field definiton identifer (e.g. "my-field")
     * @param fieldType {String} identifier of existing field type (e.g. "ezstring", "ezdate")
     * @param fieldGroup {String} identifier of existing field group (e.g. "content", "meta")
     * @param names {Array} Multi language value (see example)
     * @return {FieldDefinitionCreateStruct}
     * @example
     *     var fieldDefinition = contentTypeService.newFieldDefinitionCreateStruct(
     *         "my-new-field", "ezstring", "content", [{
     *             "_languageCode":"eng-US",
     *             "#text":"Subtitle"
     *         }]
     *     );
     */
    ContentTypeService.prototype.newFieldDefinitionCreateStruct = function (identifier, fieldType, fieldGroup, names) {
        return new FieldDefinitionCreateStruct(identifier, fieldType, fieldGroup, names);
    };

    /**
     * @method newFieldDefinitionUpdateStruct
     * @return {FieldDefinitionUpdateStruct}
     */
    ContentTypeService.prototype.newFieldDefinitionUpdateStruct = function () {
        return new FieldDefinitionUpdateStruct();
    };

// ******************************
// Content Types Groups management
// ******************************

    /**
     * Create a content type group
     *
     * @method createContentTypeGroup
     * @param contentTypeGroups {String} link to root ContentTypeGroups resource (should be auto-discovered)
     * @param contentTypeGroupCreateStruct {ContentTypeGroupInputStruct} object describing the new group to be created
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentTypeService"}}Note on the callbacks usage{{/crossLink}} for more info)
     * @example
     *
     *
     *     var contentTypeGroupCreateStruct = contentTypeService.newContentTypeGroupInputStruct(
     *         "new-group-id"
     *     );
     *
     *     contentTypeService.createContentTypeGroup(
     *         "/api/ezp/v2/content/typegroups",
     *         contentTypeGroupCreateStruct,
     *         callback
     *     );
     */
    ContentTypeService.prototype.createContentTypeGroup = function (contentTypeGroups, contentTypeGroupCreateStruct, callback) {
        this._connectionManager.request(
            "POST",
            contentTypeGroups,
            JSON.stringify(contentTypeGroupCreateStruct.body),
            contentTypeGroupCreateStruct.headers,
            callback
        );
    };

    /**
     * Load all content type groups
     *
     * @method loadContentTypeGroups
     * @param contentTypeGroups {String} link to root ContentTypeGroups resource (should be auto-discovered)
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentTypeService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentTypeService.prototype.loadContentTypeGroups = function (contentTypeGroups, callback) {
        this._connectionManager.request(
            "GET",
            contentTypeGroups,
            "",
            {"Accept": "application/vnd.ez.api.ContentTypeGroupList+json"},
            callback
        );
    };

    /**
     * Load single content type group
     *
     * @method loadContentTypeGroup
     * @param contentTypeGroupId {String} target content type group identifier (e.g. "/api/ezp/v2/content/types/100")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentTypeService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentTypeService.prototype.loadContentTypeGroup = function (contentTypeGroupId, callback) {
        this._connectionManager.request(
            "GET",
            contentTypeGroupId,
            "",
            {"Accept": "application/vnd.ez.api.ContentTypeGroup+json"},
            callback
        );
    };

    /**
     * Update a content type group
     *
     * @method updateContentTypeGroup
     * @param contentTypeGroupId {String} target content type group identifier (e.g. "/api/ezp/v2/content/types/100")
     * @param contentTypeGroupUpdateStruct {ContentTypeGroupInputStruct} object describing changes to the content type group
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentTypeService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentTypeService.prototype.updateContentTypeGroup = function (contentTypeGroupId, contentTypeGroupUpdateStruct, callback) {
        this._connectionManager.request(
            "PATCH",
            contentTypeGroupId,
            JSON.stringify(contentTypeGroupUpdateStruct.body),
            contentTypeGroupUpdateStruct.headers,
            callback
        );
    };

    /**
     * Delete content type group
     *
     * @method deleteContentTypeGroup
     * @param contentTypeGroupId {String}
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentTypeService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentTypeService.prototype.deleteContentTypeGroup = function (contentTypeGroupId, callback) {
        this._connectionManager.delete(
            contentTypeGroupId,
            callback
        );
    };

    /**
     * List content for a content type group
     *
     * @method loadContentTypes
     * @param contentTypeGroupId {String} target content type group identifier (e.g. "/api/ezp/v2/content/typegroups/1")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentTypeService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentTypeService.prototype.loadContentTypes = function (contentTypeGroupId, callback) {
        var that = this;

        this.loadContentTypeGroup(
            contentTypeGroupId,
            function (error, contentTypeGroupResponse) {
                if (error) {
                    callback(error, false);
                    return;
                }

                var contentTypeGroup = contentTypeGroupResponse.document.ContentTypeGroup;

                that._connectionManager.request(
                    "GET",
                     contentTypeGroup.ContentTypes._href,
                    "",
                    {"Accept": contentTypeGroup.ContentTypes["_media-type"]},
                    callback
                );
            }
        );
    };

    /**
     * @method loadContentTypeGroupByIdentifier
     * @param contentTypeGroups {String} link to root ContentTypeGroups resource (should be auto-discovered)
     * @param identifier {String} target content type group identifier (e.g. "content")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentTypeService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentTypeService.prototype.loadContentTypeGroupByIdentifier = function (contentTypeGroups, identifier, callback) {
        this._connectionManager.request(
            "GET",
            contentTypeGroups + "?identifier=" + identifier,
            "",
            {"Accept": "application/vnd.ez.api.ContentTypeGroup+json"},
            callback
        );
    };

// ******************************
// Content Types management
// ******************************

    /**
     * Create a content type
     *
     * @method createContentType
     * @param contentTypeGroupId {String} target content type group identifier (e.g. "/api/ezp/v2/content/typegroups/1")
     * @param contentTypeCreateStruct {ContentTypeCreateStruct} object describing the new content type to be created
     * @param publish {Boolean} weather the content type should be immediately published or not
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentTypeService"}}Note on the callbacks usage{{/crossLink}} for more info)
     * @example
     *
     *     var contentTypeCreateStruct, fieldDefinition;
     *
     *     contentTypeCreateStruct = contentTypeService.newContentTypeCreateStruct(
     *          "some-id", "eng-US", [{
     *              "_languageCode":"eng-US",
     *              "#text":"Some Name"
     *          }]
     *     );
     *
     *     fieldDefinition = contentTypeService.newFieldDefinitionCreateStruct(
     *         "my-new-field", "ezstring", "content", [{
     *             "_languageCode":"eng-US",
     *             "#text":"Subtitle"
     *         }]
     *     );
     *
     *     contentTypeCreateStruct.body.ContentTypeCreate.FieldDefinitions.FieldDefinition.push(fieldDefinition.body.FieldDefinitionCreate);
     *
     *     contentTypeService.createContentType(
     *         "/api/ezp/v2/content/typegroups/1",
     *         contentTypeCreateStruct,
     *         true,
     *         callback
     *     );
     */
    ContentTypeService.prototype.createContentType = function (contentTypeGroupId, contentTypeCreateStruct, publish, callback) {
        var that = this;

        this.loadContentTypeGroup(
            contentTypeGroupId,
            function (error, contentTypeGroupResponse) {
                if (error) {
                    callback(error, false);
                    return;
                }

                var contentTypeGroup = contentTypeGroupResponse.document.ContentTypeGroup,
                    parameters = (publish === true) ? "?publish=true": "";

                that._connectionManager.request(
                    "POST",
                    contentTypeGroup.ContentTypes._href + parameters,
                    JSON.stringify(contentTypeCreateStruct.body),
                    contentTypeCreateStruct.headers,
                    callback
                );
            }
        );
    };

    /**
     * Make a copy of the target content type
     *
     * @method copyContentType
     * @param contentTypeId {String} target content type identifier (e.g. "/api/ezp/v2/content/types/18")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentTypeService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentTypeService.prototype.copyContentType = function (contentTypeId, callback) {
        this._connectionManager.request(
            "COPY",
            contentTypeId,
            "",
            {},
            callback
        );
    };

    /**
     * Load the target content type
     *
     * @method loadContentType
     * @param contentTypeId {String} target content type identifier (e.g. "/api/ezp/v2/content/types/18")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentTypeService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentTypeService.prototype.loadContentType = function (contentTypeId, callback) {
        this._connectionManager.request(
            "GET",
            contentTypeId,
            "",
            {"Accept": "application/vnd.ez.api.ContentType+json"},
            callback
        );
    };

    /**
     * Load content type by the string identifier
     *
     * @method loadContentTypeByIdentifier
     * @param identifier {String} target content type string identifier (e.g. "blog")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentTypeService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentTypeService.prototype.loadContentTypeByIdentifier = function (identifier, callback) {
        var that = this;

        this._discoveryService.getInfoObject(
            "contentTypes",
            function (error, contentTypes) {
                if (error) {
                    callback(error, false);
                    return;
                }

                that._connectionManager.request(
                    "GET",
                    contentTypes._href + "?identifier=" + identifier,
                    "",
                    {"Accept": contentTypes["_media-type"]},
                    callback
                );
            }
        );
    };

    /**
     * Delete the target content type
     *
     * @method deleteContentType
     * @param contentTypeId {String} target content type identifier (e.g. "/api/ezp/v2/content/types/18")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentTypeService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentTypeService.prototype.deleteContentType = function (contentTypeId, callback) {
        this._connectionManager.delete(
            contentTypeId,
            callback
        );
    };

    /**
     * Load content type groups of the target content type
     *
     * @method loadGroupsOfContentType
     * @param contentTypeId {String} target content type identifier (e.g. "/api/ezp/v2/content/types/18")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentTypeService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentTypeService.prototype.loadGroupsOfContentType = function (contentTypeId, callback) {
        this._connectionManager.request(
            "GET",
            contentTypeId + '/groups',
            "",
            {"Accept": "application/vnd.ez.api.ContentTypeGroupRefList+json"},
            callback
        );
    };

    /**
     * Assign the target content type to the target content type group
     *
     * @method assignContentTypeGroup
     * @param contentTypeId {String} target content type identifier (e.g. "/api/ezp/v2/content/types/18")
     * @param groupId{String} target content type group identifier (e.g. "/api/ezp/v2/content/typegroups/2")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentTypeService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentTypeService.prototype.assignContentTypeGroup = function (contentTypeId, groupId, callback) {
        this._connectionManager.request(
            "POST",
            contentTypeId + "/groups" + "?group=" + groupId,
            "",
            {},
            callback
        );
    };

    /**
     * Remove content type assignment to the target content type group
     *
     * @method unassignContentTypeGroup
     * @param contentTypeAssignedGroupId {String} target content type group assignment  (e.g. "/api/ezp/v2/content/types/18/groups/1")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentTypeService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentTypeService.prototype.unassignContentTypeGroup = function (contentTypeAssignedGroupId, callback) {
        this._connectionManager.delete(
            contentTypeAssignedGroupId,
            callback
        );
    };

// ******************************
// Drafts management
// ******************************

    /**
     * Create a new content type draft based on the target content type
     *
     * @method createContentTypeDraft
     * @param contentTypeId {String} target content type identifier (e.g. "/api/ezp/v2/content/types/18")
     * @param contentTypeUpdateStruct {ContentTypeUpdateStruct} object describing changes to the content type
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentTypeService"}}Note on the callbacks usage{{/crossLink}} for more info)
     * @example
     *     var contentTypeUpdateStruct = contentTypeService.newContentTypeUpdateStruct();
     *
     *     contentTypeUpdateStruct.names = {};
     *     contentTypeUpdateStruct.names.value = [{
     *         "_languageCode":"eng-US",
     *         "#text":"My changed content type"
     *     }]
     *
     *     contentTypeService.createContentTypeDraft(
     *         "/api/ezp/v2/content/types/18",
     *         contentTypeUpdateStruct,
     *         callback
     *     );
     */
    ContentTypeService.prototype.createContentTypeDraft = function (contentTypeId, contentTypeUpdateStruct, callback) {
        this._connectionManager.request(
            "POST",
            contentTypeId,
            JSON.stringify(contentTypeUpdateStruct.body),
            contentTypeUpdateStruct.headers,
            callback
        );
    };

    /**
     * Load draft of the target content type
     *
     * @method loadContentTypeDraft
     * @param contentTypeId {String} target content type identifier (e.g. "/api/ezp/v2/content/types/18")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentTypeService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentTypeService.prototype.loadContentTypeDraft = function (contentTypeId, callback) {
        this._connectionManager.request(
            "GET",
            contentTypeId + "/draft",
            "",
            {"Accept": "application/vnd.ez.api.ContentType+json"},
            callback
        );
    };

    /**
     * Update the target content type draft metadata. This method does not handle field definitions
     *
     * @method updateContentTypeDraftMetadata
     * @param contentTypeDraftId {String} target content type draft identifier (e.g. "/api/ezp/v2/content/types/18/draft")
     * @param contentTypeUpdateStruct {ContentTypeUpdateStruct} object describing changes to the draft
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentTypeService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentTypeService.prototype.updateContentTypeDraftMetadata = function (contentTypeDraftId, contentTypeUpdateStruct, callback) {
        this._connectionManager.request(
            "PATCH",
            contentTypeDraftId,
            JSON.stringify(contentTypeUpdateStruct.body),
            contentTypeUpdateStruct.headers,
            callback
        );
    };

    /**
     * Publish the target content type draft
     *
     * @method publishContentTypeDraft
     * @param contentTypeDraftId {String} target content type draft identifier (e.g. "/api/ezp/v2/content/types/18/draft")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentTypeService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentTypeService.prototype.publishContentTypeDraft = function (contentTypeDraftId, callback) {
        this._connectionManager.request(
            "PUBLISH",
            contentTypeDraftId,
            "",
            {},
            callback
        );
    };

    /**
     * Delete the target content type draft
     *
     * @method deleteContentTypeDraft
     * @param contentTypeDraftId {String} target content type draft identifier (e.g. "/api/ezp/v2/content/types/18/draft")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentTypeService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentTypeService.prototype.deleteContentTypeDraft = function (contentTypeDraftId, callback) {
        this._connectionManager.delete(
            contentTypeDraftId,
            callback
        );
    };

// ******************************
// Field Definitions management
// ******************************

    /**
     * Add a new field definition to the target Content Type draft
     *
     * @method addFieldDefinition
     * @param contentTypeId {String} target content type identifier (e.g. "/api/ezp/v2/content/types/18")
     * @param fieldDefinitionCreateStruct {FieldDefinitionCreateStruct} object describing the new field definition to be created
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentTypeService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentTypeService.prototype.addFieldDefinition = function (contentTypeId, fieldDefinitionCreateStruct, callback) {
        var that = this;

        this.loadContentTypeDraft(
            contentTypeId,
            function (error, contentTypeDraftResponse) {
                if (error) {
                    callback(error, false);
                    return;
                }

                var contentTypeDraftFieldDefinitions = contentTypeDraftResponse.document.ContentType.FieldDefinitions;

                that._connectionManager.request(
                    "POST",
                    contentTypeDraftFieldDefinitions._href,
                    JSON.stringify(fieldDefinitionCreateStruct.body),
                    fieldDefinitionCreateStruct.headers,
                    callback
                );
            }
        );
    };

    /**
     * Load the target field definition
     *
     * @method loadFieldDefinition
     * @param fieldDefinitionId {String} target field definition identifier (e.g. "/api/ezp/v2/content/types/42/fieldDefinitions/311")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentTypeService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentTypeService.prototype.loadFieldDefinition = function (fieldDefinitionId, callback) {
        this._connectionManager.request(
            "GET",
            fieldDefinitionId,
            "",
            {"Accept": "application/vnd.ez.api.FieldDefinition+json"},
            callback
        );
    };

    /**
     * Update the target (existing) field definition
     *
     * @method updateFieldDefinition
     * @param fieldDefinitionId {String} target field definition identifier (e.g. "/api/ezp/v2/content/types/42/fieldDefinitions/311")
     * @param fieldDefinitionUpdateStruct {FieldDefinitionUpdateStruct} object describing changes to the target field definition
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentTypeService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentTypeService.prototype.updateFieldDefinition = function (fieldDefinitionId, fieldDefinitionUpdateStruct, callback) {
        this._connectionManager.request(
            "PATCH",
            fieldDefinitionId,
            JSON.stringify(fieldDefinitionUpdateStruct.body),
            fieldDefinitionUpdateStruct.headers,
            callback
        );
    };

    /**
     * Delete existing field definition
     *
     * @method deleteFieldDefinition
     * @param fieldDefinitionId {String} target field definition identifier (e.g. "/api/ezp/v2/content/types/42/fieldDefinitions/311")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "ContentTypeService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    ContentTypeService.prototype.deleteFieldDefinition = function (fieldDefinitionId, callback) {
        this._connectionManager.delete(
            fieldDefinitionId,
            callback
        );
    };

    return ContentTypeService;

});

/* global define */
define('structures/SessionCreateStruct',[],function () {
    

    /**
     * Returns a structure used to create a new Session. See
     * {{#crossLink "UserService/createSession"}}UserService.createSession{{/crossLink}}
     *
     * @class SessionCreateStruct
     * @constructor
     * @param login {String} login for a user, which wants to start a session
     * @param password {String} password for a user, which wants to start a session
     */
    var SessionCreateStruct = function (login, password) {
        this.body = {};
        this.body.SessionInput = {};

        this.body.SessionInput.login = login;
        this.body.SessionInput.password = password;

        this.headers = {
            "Accept": "application/vnd.ez.api.Session+json",
            "Content-Type": "application/vnd.ez.api.SessionInput+json"
        };

        return this;
    };

    return SessionCreateStruct;

});
/* global define */
define('structures/UserCreateStruct',[],function () {
    

    /**
     * Returns a structure used to create a new User. See
     * {{#crossLink "UserService/createUser"}}UserService.createUser{{/crossLink}}
     *
     * @class UserCreateStruct
     * @constructor
     * @param languageCode {String} The language code (eng-GB, fre-FR, ...)
     * @param login {String} login for a new user
     * @param email {String} email for a new user
     * @param password {String} password for a new user
     * @param fields {Array} fields array (see example in
     * {{#crossLink "UserService/newUserGroupCreateStruct"}}UserService.newUserGroupCreateStruct{{/crossLink}})
     */
    var UserCreateStruct = function (languageCode, login, email, password, fields) {
        this.body = {};
        this.body.UserCreate = {};

        this.body.UserCreate.mainLanguageCode = languageCode;
        this.body.UserCreate.login = login;
        this.body.UserCreate.email = email;
        this.body.UserCreate.password = password;

        this.body.UserCreate.fields = {};
        this.body.UserCreate.fields.field = fields;

        this.headers = {};
        this.headers.Accept = "application/vnd.ez.api.User+json";
        this.headers["Content-Type"] = "application/vnd.ez.api.UserCreate+json";

        return this;
    };

    return UserCreateStruct;

});
/* global define */
define('structures/UserUpdateStruct',[],function () {
    

    /**
     * Returns a structure used to update a User. See
     * {{#crossLink "UserService/updateUser"}}UserService.updateUser{{/crossLink}}
     *
     * @class UserUpdateStruct
     * @constructor
     */
    var UserUpdateStruct = function () {
        this.body = {};
        this.body.UserUpdate = {};

        this.body.UserUpdate.fields = {};
        this.body.UserUpdate.fields.field = [];

        this.headers = {};
        this.headers.Accept = "application/vnd.ez.api.User+json";
        this.headers["Content-Type"] = "application/vnd.ez.api.UserUpdate+json";

        return this;
    };

    return UserUpdateStruct;

});
/* global define */
define('structures/UserGroupCreateStruct',[],function () {
    

    /**
     * Returns a structure used to create a new User group. See
     * {{#crossLink "UserService/createUserGroup"}}UserService.createUserGroup{{/crossLink}}
     *
     * @class UserGroupCreateStruct
     * @constructor
     * @param languageCode {String} The language code (eng-GB, fre-FR, ...)
     * @param fields {Array} fields array (see example in
     * {{#crossLink "UserService/newUserGroupCreateStruct"}}UserService.newUserGroupCreateStruct{{/crossLink}})
     */
    var UserGroupCreateStruct = function (languageCode, fields) {
        this.body = {};
        this.body.UserGroupCreate = {};

        this.body.UserGroupCreate.mainLanguageCode = languageCode;

        this.body.UserGroupCreate.fields = {};
        this.body.UserGroupCreate.fields.field = fields;

        this.headers = {};
        this.headers.Accept = "application/vnd.ez.api.UserGroup+json";
        this.headers["Content-Type"] = "application/vnd.ez.api.UserGroupCreate+json";

        return this;
    };

    return UserGroupCreateStruct;

});
/* global define */
define('structures/UserGroupUpdateStruct',[],function () {
    

    /**
     * Returns a structure used to update a User group. See
     * {{#crossLink "UserService/updateUserGroup"}}UserService.updateUserGroup{{/crossLink}}
     *
     * @class UserGroupUpdateStruct
     * @constructor
     * @param languageCode {String} The language code (eng-GB, fre-FR, ...)
     * @param fields {Array} fields array (see example in
     * {{#crossLink "UserService/newUserGroupCreateStruct"}}UserService.newUserGroupCreateStruct{{/crossLink}})
     */
    var UserGroupUpdateStruct = function (languageCode, fields) {
        this.body = {};
        this.body.UserGroupUpdate = {};

        this.body.UserGroupUpdate.fields = {};
        this.body.UserGroupUpdate.fields.field = [];

        this.headers = {};
        this.headers.Accept = "application/vnd.ez.api.UserGroup+json";
        this.headers["Content-Type"] = "application/vnd.ez.api.UserGroupUpdate+json";

        return this;
    };

    return UserGroupUpdateStruct;

});
/* global define */
define('structures/PolicyCreateStruct',[],function () {
    

    /**
     * Returns a structure used to create a new Policy. See
     * {{#crossLink "UserService/addPolicy"}}UserService.addPolicy{{/crossLink}}
     *
     * @class PolicyCreateStruct
     * @constructor
     * @param module {String} name of the module for which new policy should be active
     * @param theFunction {String} name of the function for which the new policy should be active
     * @param limitations {Object} object describing limitations for new policy
     */
    var PolicyCreateStruct = function (module, theFunction, limitations) {
        this.body = {};
        this.body.PolicyCreate = {};

        this.body.PolicyCreate.module = module;
        this.body.PolicyCreate.function = theFunction;

        this.body.PolicyCreate.limitations = {};
        this.body.PolicyCreate.limitations.limitation = limitations;

        this.headers = {};
        this.headers.Accept = "application/vnd.ez.api.Policy+json";
        this.headers["Content-Type"] = "application/vnd.ez.api.PolicyCreate+json";

        return this;
    };

    return PolicyCreateStruct;

});
/* global define */
define('structures/PolicyUpdateStruct',[],function () {
    

    /**
     * Returns a structure used to update a Policy. See
     * {{#crossLink "UserService/updatePolicy"}}UserService.updatePolicy{{/crossLink}}
     *
     * @class PolicyUpdateStruct
     * @constructor
     * @param limitations {Object} object describing limitations change for the policy
     */
    var PolicyUpdateStruct = function (limitations) {
        this.body = {};
        this.body.PolicyUpdate = {};

        this.body.PolicyUpdate.limitations = {};
        this.body.PolicyUpdate.limitations.limitation = limitations;

        this.headers = {};
        this.headers.Accept = "application/vnd.ez.api.Policy+json";
        this.headers["Content-Type"] = "application/vnd.ez.api.PolicyUpdate+json";

        return this;
    };

    return PolicyUpdateStruct;

});
/* global define */
define('structures/RoleInputStruct',[],function () {
    

    /**
     * Returns a structure used to create and update a Role. See
     * {{#crossLink "UserService/createRole"}}UserService.createRole{{/crossLink}}
     *
     * @class RoleInputStruct
     * @constructor
     * @param identifier {String} unique Role identifier
     */
    var RoleInputStruct = function (identifier) {
        this.body = {};
        this.body.RoleInput = {};

        this.body.RoleInput.identifier = identifier;

        this.headers = {};
        this.headers.Accept = "application/vnd.ez.api.Role+json";
        this.headers["Content-Type"] = "application/vnd.ez.api.RoleInput+json";

        return this;
    };

    return RoleInputStruct;

});
/* global define */
define('structures/RoleAssignInputStruct',[],function () {
    

    /**
     * Returns a structure used to create and update a Role Assign object. See for ex.
     * {{#crossLink "UserService/assignRoleToUser"}}UserService.assignRoleToUser{{/crossLink}}
     *
     * @class RoleAssignInputStruct
     * @constructor
     * @param role {Object} object representing the target role
     * @param limitation {Object} object representing limitations for assignment (see example in
     * {{#crossLink "UserService/newRoleAssignInputStruct"}}UserService.newRoleAssignInputStruct{{/crossLink}})
     */
    var RoleAssignInputStruct = function (role, limitation) {
        this.body = {};
        this.body.RoleAssignInput = {};

        this.body.RoleAssignInput.Role = role;

        this.body.RoleAssignInput.limitation = limitation;

        this.headers = {};
        this.headers.Accept = "application/vnd.ez.api.RoleAssignmentList+json";
        this.headers["Content-Type"] = "application/vnd.ez.api.RoleAssignInput+json";

        return this;
    };

    return RoleAssignInputStruct;

});
/* global define */
define('services/UserService',['structures/SessionCreateStruct', 'structures/UserCreateStruct', 'structures/UserUpdateStruct',
        'structures/UserGroupCreateStruct', 'structures/UserGroupUpdateStruct', 'structures/PolicyCreateStruct',
        'structures/PolicyUpdateStruct', 'structures/RoleInputStruct', 'structures/RoleAssignInputStruct'],
    function (SessionCreateStruct, UserCreateStruct, UserUpdateStruct,
              UserGroupCreateStruct, UserGroupUpdateStruct, PolicyCreateStruct,
              PolicyUpdateStruct, RoleInputStruct, RoleAssignInputStruct) {
    

    /**
     * Creates an instance of user service object. Should be retrieved from CAPI instance (see example).
     *
     * ## Note on the *callbacks* usage
     *
     * The **callback** argument of the service methods always take 2 arguments:
     *
     *    *     **error** either `false` or {{#crossLink "CAPIError"}}CAPIError{{/crossLink}} object when an error occurred
     *
     *    *     **response** the {{#crossLink "Response"}}Response{{/crossLink}} object
     *
     * Example:
     *
     *     userService.loadRootUserGroup(function (error, response) {
     *            if (error) {
     *                console.log('An error occurred', error);
     *            } else {
     *                console.log('Success!', response);
     *            }
     *     });
     *
     * @class UserService
     * @constructor
     * @param connectionManager {ConnectionManager} connection manager that will be used to send requests to REST service
     * @param discoveryService {DiscoveryService} discovery service is used for urls auto-discovery automation
     * @example
     *     var userService = jsCAPI.getUserService();
     */
    var UserService = function (connectionManager, discoveryService) {
        this._connectionManager = connectionManager;
        this._discoveryService = discoveryService;
    };

// ******************************
// Structures
// ******************************

    /**
     * Returns session create structure
     *
     * @method newSessionCreateStruct
     * @param login {String} login for a user, which wants to start a session
     * @param password {String} password for a user, which wants to start a session
     * @return {SessionCreateStruct}
     */
    UserService.prototype.newSessionCreateStruct = function (login, password) {
        return new SessionCreateStruct(login, password);
    };

    /**
     * Returns user group create structure
     *
     * @method newUserGroupCreateStruct
     * @param language {String} The language code (eng-GB, fre-FR, ...)
     * @param fields {Array} fields array (see example)
     * @return {UserGroupCreateStruct}
     * @example
     *     var userGroupCreateStruct = userService.newUserGroupCreateStruct(
     *         "eng-US",[{
     *             fieldDefinitionIdentifier: "name",
     *             languageCode: "eng-US",
     *             fieldValue: "UserGroup"
     *         }, {
     *             fieldDefinitionIdentifier: "description",
     *             languageCode: "eng-US",
     *             fieldValue: "This is the description of the user group"
     *         }]
     *     );
     */
    UserService.prototype.newUserGroupCreateStruct = function (language, fields) {
        return new UserGroupCreateStruct(language, fields);
    };

    /**
     * User group update structure
     *
     * @method newUserGroupUpdateStruct
     * @return {UserGroupCreateStruct}
     */
    UserService.prototype.newUserGroupUpdateStruct = function () {
        return new UserGroupUpdateStruct();
    };

    /**
     * User create structure
     *
     * @method newUserCreateStruct
     * @param languageCode {String} The language code (eng-GB, fre-FR, ...)
     * @param login {String} login for a new user
     * @param email {String} email for a new user
     * @param password {String} password for a new user
     * @param fields {Array} fields array (see example for
     * {{#crossLink "UserService/newUserGroupCreateStruct"}}UserService.newUserGroupCreateStruct{{/crossLink}})
     * @return {UserCreateStruct}
     */
    UserService.prototype.newUserCreateStruct = function (languageCode, login, email, password, fields) {
        return new UserCreateStruct(languageCode, login, email, password, fields);
    };

    /**
     * Returns user update structure
     *
     * @method newUserUpdateStruct
     * @return {UserUpdateStruct}
     */
    UserService.prototype.newUserUpdateStruct = function () {
        return new UserUpdateStruct();
    };

    /**
     * Returns role input structure
     *
     * @method newRoleInputStruct
     * @param identifier {String} unique identifier for the new role (e.g. "editor")
     * @return {RoleInputStruct}
     */
    UserService.prototype.newRoleInputStruct = function (identifier) {
        return new RoleInputStruct(identifier);
    };

    /**
     * Returns target role assignment input structure
     *
     * @method newRoleAssignInputStruct
     * @param role {Object} object representing the target role (see example)
     * @param limitation {Object} object representing limitations for assignment (see example)
     * @return {RoleAssignInputStruct}
     * @example
     *     var roleAssignCreateStruct = userService.newRoleAssignInputStruct(
     *         {
     *             "_href": "/api/ezp/v2/user/roles/7",
     *             "_media-type": "application/vnd.ez.api.RoleAssignInput+json"
     *         }, {
     *             "_identifier": "Section",
     *             "values": {
     *                 "ref": [{
     *                     "_href": "/api/ezp/v2/content/sections/1",
     *                     "_media-type": "application/vnd.ez.api.Section+json"
     *                 }, {
     *                     "_href": "/api/ezp/v2/content/sections/4",
     *                     "_media-type": "application/vnd.ez.api.Section+json"
     *                 }]
     *             }
     *         });
     *
     */
    UserService.prototype.newRoleAssignInputStruct = function (role, limitation) {
        return new RoleAssignInputStruct(role, limitation);
    };

    /**
     * Returns policy create structure
     *
     * @method newPolicyCreateStruct
     * @param module {String} name of the module for which new policy should be active
     * @param theFunction {String} name of the function for which the new policy should be active
     * @param limitations {Object} object describing limitations for new policy
     * @return {PolicyCreateStruct}
     * @example
     *     var policyCreateStruct = userService.newPolicyCreateStruct(
     *         "content", "publish", [{
     *             limitation: [{
     *                 "_identifier": "Section",
     *                 "values": {
     *                     "ref": [{
     *                         "_href": "5"
     *                     }, {
     *                         "_href": "4"
     *                     }]
     *                 }
     *             }]
     *         }]
     *     );
     */
    UserService.prototype.newPolicyCreateStruct = function (module, theFunction, limitations) {
        return new PolicyCreateStruct(module, theFunction, limitations);
    };

    /**
     * Policy update structure
     *
     * @method newPolicyUpdateStruct
     * @param limitations {Object} object describing limitations change for the policy (see "newPolicyCreateStruct" example)
     * @return {PolicyUpdateStruct}
     */
    UserService.prototype.newPolicyUpdateStruct = function (limitations) {
        return new PolicyUpdateStruct(limitations);
    };

// ******************************
// User groups management
// ******************************

    /**
     * Load the root user group
     *
     * @method loadRootUserGroup
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.loadRootUserGroup = function (callback) {
        var that = this;

        this._discoveryService.getInfoObject(
            "rootUserGroup",
            function (error, rootUserGroup) {
                if (error) {
                    callback(error, false);
                    return;
                }

                that._connectionManager.request(
                    "GET",
                    rootUserGroup._href,
                    "",
                    {"Accept": rootUserGroup["_media-type"]},
                    callback
                );
            });
    };

    /**
     * Load the target user group
     *
     * @method loadUserGroup
     * @param userGroupId {String} target user group identifier (e.g. "/api/ezp/v2/user/groups/1/5")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.loadUserGroup = function (userGroupId, callback) {
        this._connectionManager.request(
            "GET",
            userGroupId,
            "",
            {"Accept": "application/vnd.ez.api.UserGroup+json"},
            callback
        );
    };

    /**
     * Load the target user group by remoteId
     *
     * @method loadUserGroupByRemoteId
     * @param userGroups {String} link to root UserGroups resource (should be auto-discovered)
     * @param remoteId {String} target user group remote identifier (e.g. "f5c88a2209584891056f987fd965b0ba")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.loadUserGroupByRemoteId = function (userGroups, remoteId, callback) {
        this._connectionManager.request(
            "GET",
            userGroups + '?remoteId=' + remoteId,
            "",
            {"Accept": "application/vnd.ez.api.UserGroupList+json"},
            callback
        );
    };

    /**
     * Delete the target user group
     *
     * @method deleteUserGroup
     * @param userGroupId {String} target user group identifier (e.g. "/api/ezp/v2/user/groups/1/5")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.deleteUserGroup = function (userGroupId, callback) {
        this._connectionManager.delete(
            userGroupId,
            callback
        );
    };

    /**
     * Move the target user group to the destination
     *
     * @method moveUserGroup
     * @param userGroupId {String} target user group identifier (e.g. "/api/ezp/v2/user/groups/1/5")
     * @param destination {String} destination identifier (e.g. "/api/ezp/v2/user/groups/1/5/110")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.moveUserGroup = function (userGroupId, destination, callback) {
        this._connectionManager.request(
            "MOVE",
            userGroupId,
            "",
            {"Destination": destination},
            callback
        );
    };

    /**
     * Create a new user group in the provided parent user group
     *
     * @method createUserGroup
     * @param parentGroupId {String} target parent user group identifier (e.g. "/api/ezp/v2/user/groups/1/5")
     * @param userGroupCreateStruct {UserGroupCreateStruct} object describing new user group to be created
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.createUserGroup = function (parentGroupId, userGroupCreateStruct, callback) {
        var that = this;

        this.loadUserGroup(
            parentGroupId,
            function (error, userGroupResponse) {
                if (error) {
                    callback(error, false);
                    return;
                }

                var subGroups = userGroupResponse.document.UserGroup.Subgroups;

                that._connectionManager.request(
                    "POST",
                    subGroups._href,
                    JSON.stringify(userGroupCreateStruct.body),
                    userGroupCreateStruct.headers,
                    callback
                );
            }
        );
    };

    /**
     * Update the target user group
     *
     * @method updateUserGroup
     * @param userGroupId {String} target user group identifier (e.g. "/api/ezp/v2/user/groups/1/5")
     * @param userGroupUpdateStruct {UserGroupUpdateStruct} object describing changes to the target user group
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.updateUserGroup = function (userGroupId, userGroupUpdateStruct, callback) {
        this._connectionManager.request(
            "PATCH",
            userGroupId,
            JSON.stringify(userGroupUpdateStruct.body),
            userGroupUpdateStruct.headers,
            callback
        );
    };

    /**
     * Load subgroups of the target user group
     *
     * @method loadSubUserGroups
     * @param userGroupId {String} target user group identifier (e.g. "/api/ezp/v2/user/groups/1/5")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.loadSubUserGroups = function (userGroupId, callback) {
        var that = this;

        this.loadUserGroup(
            userGroupId,
            function (error, userGroupResponse) {
                if (error) {
                    callback(error, false);
                    return;
                }

                var subGroups = userGroupResponse.document.UserGroup.Subgroups;

                that._connectionManager.request(
                    "GET",
                    subGroups._href,
                    "",
                    {"Accept": subGroups["_media-type"]},
                    callback
                );
            }
        );
    };

    /**
     * Load users of the target user group
     *
     * @method loadUsersOfUserGroup
     * @param userGroupId {String} target user group identifier (e.g. "/api/ezp/v2/user/groups/1/5")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.loadUsersOfUserGroup = function (userGroupId, callback) {
        var that = this;

        this.loadUserGroup(
            userGroupId,
            function (error, userGroupResponse) {
                if (error) {
                    callback(error, false);
                    return;
                }

                var users = userGroupResponse.document.UserGroup.Users;

                that._connectionManager.request(
                    "GET",
                    users._href,
                    "",
                    {"Accept": users["_media-type"]},
                    callback
                );
            }
        );
    };

    /**
     * Load user groups for the target user
     *
     * @method loadUserGroupsOfUser
     * @param userId {String} target user identifier (e.g. "/api/ezp/v2/user/users/14")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.loadUserGroupsOfUser = function (userId, callback) {
        this._connectionManager.request(
            "GET",
            userId + '/groups',
            "",
            {"Accept": "application/vnd.ez.api.UserGroupRefList+json"},
            callback
        );
    };

// ******************************
// Users management
// ******************************

    /**
     * Create a new user
     *
     * @method createUser
     * @param userGroupId {String} target user group identifier (e.g. "/api/ezp/v2/user/groups/1/5")
     * @param userCreateStruct {UserCreateStruct} object describing new user to be created
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.createUser = function (userGroupId, userCreateStruct, callback) {
        var that = this;

        this.loadUserGroup(
            userGroupId,
            function (error, userGroupResponse) {
                if (error) {
                    callback(error, false);
                    return;
                }

                var users = userGroupResponse.document.UserGroup.Users;

                that._connectionManager.request(
                    "POST",
                    users._href,
                    JSON.stringify(userCreateStruct.body),
                    userCreateStruct.headers,
                    callback
                );
            }
        );
    };

    /**
     * Load users and usergroups for the target roleId
     *
     * @method getRoleAssignments
     * @param userList {String} link to root UserList resource (should be auto-discovered)
     * @param roleId {String} target role identifier (e.g. "/api/ezp/v2/user/roles/5")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.getRoleAssignments = function (userList, roleId, callback) {
        this._connectionManager.request(
            "GET",
            userList + '?roleId=' + roleId,
            "",
            {"Accept": "application/vnd.ez.api.UserList+json"},
            callback
        );
    };

    /**
     * Load the target user
     *
     * @method loadUser
     * @param userId {String} target user identifier (e.g. "/api/ezp/v2/user/users/144")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.loadUser = function (userId, callback) {
        this._connectionManager.request(
            "GET",
            userId,
            "",
            {"Accept": "application/vnd.ez.api.User+json"},
            callback
        );
    };

    /**
     * Update the target user
     *
     * @method updateUser
     * @param userId {String} target user identifier (e.g. "/api/ezp/v2/user/users/144")
     * @param userUpdateStruct {UserUpdateStruct} object describing changes to the user
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     * @example
     *     var userUpdateStruct = userService.newUserUpdateStruct();
     *     userUpdateStruct.body.UserUpdate.email = "somenewemail@nowhere.no";
     *     userService.updateUser(
     *         "/api/ezp/v2/user/users/144",
     *         userUpdateStruct,
     *         callback
     *     );
     */
    UserService.prototype.updateUser = function (userId, userUpdateStruct, callback) {
        this._connectionManager.request(
            "PATCH",
            userId,
            JSON.stringify(userUpdateStruct.body),
            userUpdateStruct.headers,
            callback
        );
    };

    /**
     * Delete the target user
     *
     * @method deleteUser
     * @param userId {String} target user identifier (e.g. "/api/ezp/v2/user/users/144")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.deleteUser = function (userId, callback) {
        this._connectionManager.delete(
            userId,
            callback
        );
    };

// ******************************
// Users and groups relation management
// ******************************

    /**
     * Assign the target user to the target user group
     *
     * @method loadUser
     * @param userId {String} target user identifier (e.g. "/api/ezp/v2/user/users/144")
     * @param userGroupId {String} target user group identifier (e.g. "/api/ezp/v2/user/groups/2")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.assignUserToUserGroup = function (userId, userGroupId, callback) {
        var that = this;

        this.loadUser(
            userId,
            function (error, userResponse) {
                if (error) {
                    callback(error, false);
                    return;
                }

                var userGroups = userResponse.document.User.UserGroups;

                that._connectionManager.request(
                    "POST",
                    userGroups._href + "?group=" + userGroupId,
                    "",
                    {"Accept": userGroups["_media-type"]},
                    callback
                );
            }
        );
    };

    /**
     * Remove target assignment (of a user to a user group)
     *
     * @method unassignUserFromUserGroup
     * @param userAssignedGroupId {String} target assignment identifier (e.g. "/api/ezp/v2/user/users/146/groups/1")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.unassignUserFromUserGroup = function (userAssignedGroupId, callback) {
        this._connectionManager.delete(
            userAssignedGroupId,
            callback
        );
    };

// ******************************
// Roles management
// ******************************

    /**
     * Create a new role
     *
     * @method createRole
     * @param roleCreateStruct {RoleCreateStruct} object describing new role to be created
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.createRole = function (roleCreateStruct, callback) {
        var that = this;

        this._discoveryService.getInfoObject(
            "roles",
            function (error, roles) {
                if (error) {
                    callback(error, false);
                    return;
                }

                that._connectionManager.request(
                    "POST",
                    roles._href,
                    JSON.stringify(roleCreateStruct.body),
                    roleCreateStruct.headers,
                    callback
                );
            }
        );
    };

    /**
     * Load the target role
     *
     * @method loadRole
     * @param roleId {String} target role identifier (e.g. "/api/ezp/v2/user/roles/5")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.loadRole = function (roleId, callback) {
        this._connectionManager.request(
            "GET",
            roleId,
            "",
            {"Accept": "application/vnd.ez.api.Role+json"},
            callback
        );
    };

    /**
     * Search roles by string identifier and apply certain limit and offset on the result set
     *
     * @method loadRoles
     * @param [identifier] {String} string identifier of the roles to search (e.g. "admin")
     * @param [limit=-1] {int} the limit of the result set
     * @param [offset=0] {int} the offset of the result set
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     * @example
     *     userService.loadRoles("admin", 5, 5, callback);
     */
    UserService.prototype.loadRoles = function (identifier, limit, offset, callback) {

        var that = this,
            identifierQuery,
            defaultIdentifier = "",
            defaultLimit = -1,
            defaultOffset = 0;

        // default values for omitted parameters (if any)
        if (arguments.length < 4) {
            if (typeof identifier == "function") {
                // no optional params are passed
                callback = identifier;
                identifier = defaultIdentifier;
                limit = defaultLimit;
                offset = defaultOffset;
            } else if (typeof limit == "function") {
                // only identifier is passed
                callback = limit;
                limit = defaultLimit;
                offset = defaultOffset;
            } else {
                // identifier and limit are passed
                callback = offset;
                offset = defaultOffset;
            }
        }

        identifierQuery = (identifier === "") ? "" : "&identifier=" + identifier;

        this._discoveryService.getInfoObject(
            "roles",
            function (error, roles) {
                if (error) {
                    callback(error, false);
                    return;
                }

                that._connectionManager.request(
                    "GET",
                    roles._href + '?offset=' + offset + '&limit=' + limit + identifierQuery,
                    "",
                    {"Accept": roles["_media-type"]},
                    callback
                );
            }
        );
    };

    /**
     * Update the target role
     *
     * @method updateRole
     * @param roleId {String} target role identifier (e.g. "/api/ezp/v2/user/roles/5")
     * @param roleUpdateStruct {RoleUpdateStruct} object describing changes to the role
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.updateRole = function (roleId, roleUpdateStruct, callback) {
        this._connectionManager.request(
            "PATCH",
            roleId,
            JSON.stringify(roleUpdateStruct.body),
            roleUpdateStruct.headers,
            callback
        );
    };

    /**
     * Delete the target role
     *
     * @method deleteRole
     * @param roleId {String} target role identifier (e.g. "/api/ezp/v2/user/roles/5")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.deleteRole = function (roleId, callback) {
        this._connectionManager.delete(
            roleId,
            callback
        );
    };

    /**
     * Get role assignments for the target user
     *
     * @method getRoleAssignmentsForUser
     * @param userId {String} target user identifier (e.g. "/api/ezp/v2/user/users/8")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.getRoleAssignmentsForUser = function (userId, callback) {
        var that = this;

        this.loadUser(
            userId,
            function (error, userResponse) {
                if (error) {
                    callback(error, false);
                    return;
                }

                var userRoles = userResponse.document.User.Roles;

                that._connectionManager.request(
                    "GET",
                    userRoles._href,
                    "",
                    {"Accept": userRoles["_media-type"]},
                    callback
                );
            }
        );
    };

    /**
     * Get role assignments for the target user group
     *
     * @method getRoleAssignmentsForUserGroup
     * @param userGroupId {String} target user group identifier (e.g. "/api/ezp/v2/user/groups/2")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.getRoleAssignmentsForUserGroup = function (userGroupId, callback) {
        var that = this;

        this.loadUserGroup(
            userGroupId,
            function (error, userGroupResponse) {
                if (error) {
                    callback(error, false);
                    return;
                }

                var userGroupRoles = userGroupResponse.document.UserGroup.Roles;

                that._connectionManager.request(
                    "GET",
                    userGroupRoles._href,
                    "",
                    {"Accept": userGroupRoles["_media-type"]},
                    callback
                );
            }
        );
    };

    /**
     * Get RoleAssignment object for the target assignment (of a user to a role)
     *
     * @method getUserAssignmentObject
     * @param userAssignmentId {String} target role assignment identifier (e.g. "/api/ezp/v2/user/13/roles/7")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.getUserAssignmentObject = function (userAssignmentId, callback) {
        this._connectionManager.request(
            "GET",
            userAssignmentId,
            "",
            {"Accept": "application/vnd.ez.api.RoleAssignment+json"},
            callback
        );
    };

    /**
     * Get RoleAssignment object for the target assignment (of a user group to a role)
     *
     * @method getUserGroupAssignmentObject
     * @param userGroupAssignmentId {String} target role assignment identifier (e.g. "/api/ezp/v2/user/groups/1/5/110/roles/7")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.getUserGroupAssignmentObject = function (userGroupAssignmentId, callback) {
        this._connectionManager.request(
            "GET",
            userGroupAssignmentId,
            "",
            {"Accept": "application/vnd.ez.api.RoleAssignment+json"},
            callback
        );
    };

    /**
     * Assign a role to user
     *
     * @method assignRoleToUser
     * @param userId {String}  target user identifier (e.g. "/api/ezp/v2/user/users/8")
     * @param roleAssignInputStruct {RoleAssignInputStruct} object describing the new role assignment (see "newRoleAssignInputStruct")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     *
     */
    UserService.prototype.assignRoleToUser = function (userId, roleAssignInputStruct, callback) {
        var that = this;

        this.loadUser(
            userId,
            function (error, userResponse) {
                if (error) {
                    callback(error, false);
                    return;
                }

                var userRoles = userResponse.document.User.Roles;

                that._connectionManager.request(
                    "POST",
                    userRoles._href,
                    JSON.stringify(roleAssignInputStruct.body),
                    roleAssignInputStruct.headers,
                    callback
                );
            }
        );
    };

    /**
     * Assign a role to user group
     *
     * @method assignRoleToUserGroup
     * @param userGroupId {String} target user group identifier (e.g. "/api/ezp/v2/user/groups/2")
     * @param roleAssignInputStruct {RoleAssignInputStruct} object describing the new role assignment (see "newRoleAssignInputStruct")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.assignRoleToUserGroup = function (userGroupId, roleAssignInputStruct, callback) {
        var that = this;

        this.loadUserGroup(
            userGroupId,
            function (error, userGroupResponse) {
                if (error) {
                    callback(error, false);
                    return;
                }

                var userGroupRoles = userGroupResponse.document.UserGroup.Roles;

                that._connectionManager.request(
                    "POST",
                    userGroupRoles._href,
                    JSON.stringify(roleAssignInputStruct.body),
                    roleAssignInputStruct.headers,
                    callback
                );
            }
        );
    };

    /**
     * Remove target assignment (of a user to a role)
     *
     * @method unassignRoleFromUser
     * @param userRoleId {String} target role assignment identifier (e.g. "/api/ezp/v2/user/users/110/roles/7")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.unassignRoleFromUser = function (userRoleId, callback) {
        this._connectionManager.delete(
            userRoleId,
            callback
        );
    };

    /**
     * Remove target assignment (of a user group to a role)
     *
     * @method unassignRoleFromUserGroup
     * @param userGroupRoleId {String} target role assignment identifier (e.g. "/api/ezp/v2/user/groups/2/roles/7")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.unassignRoleFromUserGroup = function (userGroupRoleId, callback) {
        this._connectionManager.delete(
            userGroupRoleId,
            callback
        );
    };

// ******************************
// Policies management
// ******************************

    /**
     * Add the new policy to the target role
     *
     * @method addPolicy
     * @param roleId {String} target role identifier (e.g. "/api/ezp/v2/user/roles/7")
     * @param policyCreateStruct {PolicyCreateStruct} object describing new policy to be created
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     * @example
     *     var policyCreateStruct = userService.newPolicyCreateStruct(
     *     "content",
     *     "create",
     *     [{  _identifier: "Class",
     *         values: {
     *             ref: [{
     *                 _href: "18"
     *             }]
     *         }
     *     }]);
     *
     *     userService.addPolicy(
     *     "/api/ezp/v2/user/roles/7",
     *     policyCreateStruct,
     *     callback);
     */
    UserService.prototype.addPolicy = function (roleId, policyCreateStruct, callback) {
        var that = this;

        this.loadRole(
            roleId,
            function (error, roleResponse) {
                if (error) {
                    callback(error, false);
                    return;
                }

                var rolePolicies = roleResponse.document.Role.Policies;

                that._connectionManager.request(
                    "POST",
                    rolePolicies._href,
                    JSON.stringify(policyCreateStruct.body),
                    policyCreateStruct.headers,
                    callback
                );
            }
        );
    };

    /**
     * Load policies of the target role
     *
     * @method loadPolicies
     * @param roleId {String} target role identifier (e.g. "/api/ezp/v2/user/roles/7")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.loadPolicies = function (roleId, callback) {
        var that = this;

        this.loadRole(
            roleId,
            function (error, roleResponse) {
                if (error) {
                    callback(error, false);
                    return;
                }

                var rolePolicies = roleResponse.document.Role.Policies;

                that._connectionManager.request(
                    "GET",
                    rolePolicies._href,
                    "",
                    {"Accept": rolePolicies["_media-type"]},
                    callback
                );
            }
        );
    };

    /**
     * Load the target policy
     *
     * @method loadPolicy
     * @param policyId {String} target policy identifier (e.g. "/api/ezp/v2/user/roles/7/policies/1")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.loadPolicy = function (policyId, callback) {
        this._connectionManager.request(
            "GET",
            policyId,
            "",
            {"Accept": "application/vnd.ez.api.Policy+json"},
            callback
        );
    };

    /**
     * Update the target policy
     *
     * @method updatePolicy
     * @param policyId {String} target policy identifier (e.g. "/api/ezp/v2/user/roles/7/policies/1")
     * @param policyUpdateStruct {PolicyUpdateStruct} object describing changes to the policy
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.updatePolicy = function (policyId, policyUpdateStruct, callback) {
        this._connectionManager.request(
            "PATCH",
            policyId,
            JSON.stringify(policyUpdateStruct.body),
            policyUpdateStruct.headers,
            callback
        );
    };

    /**
     * Delete the target policy
     *
     * @method deletePolicy
     * @param policyId {String} target policy identifier (e.g. "/api/ezp/v2/user/roles/7/policies/1")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.deletePolicy = function (policyId, callback) {
        this._connectionManager.delete(
            policyId,
            callback
        );
    };

    /**
     * Load policies for the target user
     *
     * @method loadPoliciesByUserId
     * @param userPolicies {String} link to root UserPolicies resource (should be auto-discovered)
     * @param userId {String} target user numerical identifier (e.g. 110)
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.loadPoliciesByUserId = function (userPolicies, userId, callback) {
        this._connectionManager.request(
            "GET",
            userPolicies + "?userId=" + userId,
            "",
            {"Accept": "application/vnd.ez.api.PolicyList+json"},
            callback
        );
    };

// ******************************
// Sessions management
// ******************************

    /**
     * Create a session (login a user)
     *
     * @method createSession
     * @param sessions {String} link to root Sessions resource (should be auto-discovered)
     * @param sessionCreateStruct {SessionCreateStruct} object describing new session to be created (see "newSessionCreateStruct")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.createSession = function (sessions, sessionCreateStruct, callback) {
        this._connectionManager.notAuthorizedRequest(
            "POST",
            sessions,
            JSON.stringify(sessionCreateStruct.body),
            sessionCreateStruct.headers,
            callback
        );
    };

    /**
     * Delete the target session (without actual client logout)
     *
     * @method deleteSession
     * @param sessionId {String} target session identifier (e.g. "/api/ezp/v2/user/sessions/o7i8r1sapfc9r84ae53bgq8gp4")
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.deleteSession = function (sessionId, callback) {
        this._connectionManager.delete(
            sessionId,
            callback
        );
    };

    /**
     * Actual client logout (based on deleteSession)
     * Implemented by ConnectionManager. Depends on current system configuration.
     * Kills currently active session and resets storage (e.g. LocalStorage) params (sessionId, CSRFToken)
     *
     * @method logOut
     * @param callback {Function} callback executed after performing the request (see
     *  {{#crossLink "UserService"}}Note on the callbacks usage{{/crossLink}} for more info)
     */
    UserService.prototype.logOut = function (callback) {
        this._connectionManager.logOut(callback);
    };

    return UserService;

});

/* global define */
define('CAPI',['authAgents/SessionAuthAgent', 'authAgents/HttpBasicAuthAgent', 'ConnectionManager',
        'ConnectionFeatureFactory', 'connections/XmlHttpRequestConnection', 'connections/MicrosoftXmlHttpRequestConnection',
        'services/DiscoveryService', 'services/ContentService', 'services/ContentTypeService',
        'services/UserService'],
    function (SessionAuthAgent, HttpBasicAuthAgent, ConnectionManager,
              ConnectionFeatureFactory, XmlHttpRequestConnection, MicrosoftXmlHttpRequestConnection,
              DiscoveryService, ContentService, ContentTypeService,
              UserService) {
    

    /**
     * Creates an instance of CAPI - main object which handles the API initialization and gives ability to retrieve various services.
     * Could be created only in one instance. Handles connections, authorization and REST paths discovery automatically.
     *
     * @class CAPI
     * @constructor
     * @param endPointUrl {String} url pointing to REST root
     * @param authenticationAgent {Object} Instance of one of the AuthAgents (e.g. SessionAuthAgent, HttpBasicAuthAgent)
     * @param [options] {Object} Object containing different options for the CAPI (see example)
     * @example
     *     var   authAgent = new SessionAuthAgent({
               login: "admin",
               password: "admin"
           }),
           jsCAPI = new CAPI(
               'http://ez.git.local', authAgent, {
               logRequests: true, // Whether we should log each request to the js console or not
               rootPath: '/api/ezp/v2/', // Path to the REST root
               connectionStack: [ // Array of connections, should be filled-in in preferred order
                    {connection: XmlHttpRequestConnection},
                    {connection: MicrosoftXmlHttpRequestConnection}
               ]
           });
     */
    var CAPI = function (endPointUrl, authenticationAgent, options) {
        var defaultOptions = {
                logRequests: false, // Whether we should log each request to the js console or not
                rootPath: '/api/ezp/v2/', // Path to the REST root
                connectionStack: [ // Array of connections, should be filled-in in preferred order
                    {connection: XmlHttpRequestConnection},
                    {connection: MicrosoftXmlHttpRequestConnection}
                ]
            },
            mergedOptions = defaultOptions,
            option,
            connectionFactory,
            connectionManager,
            discoveryService;

        this._contentService = null;
        this._contentTypeService = null;
        this._userService = null;

        authenticationAgent.setCAPI(this);

        // Merging provided options (if any) with defaults
        if (typeof options == "object") {
            for (option in options) {
                if (options.hasOwnProperty(option)) {
                    mergedOptions[option] = options[option];
                }
            }
        }

        connectionFactory = new ConnectionFeatureFactory(mergedOptions.connectionStack);
        connectionManager = new ConnectionManager(endPointUrl, authenticationAgent, connectionFactory);
        connectionManager.logRequests = mergedOptions.logRequests;
        discoveryService = new DiscoveryService(mergedOptions.rootPath, connectionManager);

        /**
         * Get instance of Content Service. Use ContentService to retrieve information and execute operations related to Content.
         *
         * @method getContentService
         * @return {ContentService}
         * @example
         *      var contentService = jsCAPI.getContentService();
         *      contentService.loadRoot(
         *          '/api/ezp/v2/',
         *          callback
         *      );
         */
        this.getContentService = function () {
            if  (!this._contentService)  {
                this._contentService  =  new ContentService(
                    connectionManager,
                    discoveryService
                );
            }
            return  this._contentService;
        };

        /**
         * Get instance of Content Type Service. Use ContentTypeService to retrieve information and execute operations related to ContentTypes.
         *
         * @method getContentTypeService
         * @return {ContentTypeService}
         * @example
         *      var contentTypeService = jsCAPI.getContentTypeService();
         *      contentTypeService.loadContentType(
         *          '/api/ezp/v2/content/types/18',
         *          callback
         *      );
         */
        this.getContentTypeService = function () {
            if  (!this._contentTypeService)  {
                this._contentTypeService  =  new ContentTypeService(
                    connectionManager,
                    discoveryService
                );
            }
            return  this._contentTypeService;
        };

        /**
         * Get instance of User Service. Use UserService to retrieve information and execute operations related to Users.
         *
         * @method getUserService
         * @return {UserService}
         * @example
         *      var userService = jsCAPI.getUserService();
         *      userService.loadRootUserGroup(
         *          callback
         *      );
         */
        this.getUserService = function () {
            if  (!this._userService)  {
                this._userService  =  new UserService(
                    connectionManager,
                    discoveryService
                );
            }
            return  this._userService;
        };
    };

    return CAPI;

});

/* global define, Q */
define('services/PromiseService',["structures/CAPIError"], function (CAPIError) {
    

    /**
     * Creates an instance of promise-based service object based on original service
     *
     * @class PromiseService
     * @constructor
     * @param originalService {object} the service which should be converted into promise-based version (e.g. ContentService)
     */
    var PromiseService = function (originalService) {
        var key;

        this._generatePromiseFunction = function (originalFunction) {

            return function () {
                var toBeCalledArguments = Array.prototype.slice.call(arguments),
                    deferred = Q.defer();

                if (originalFunction.length - 1 !== arguments.length) {
                    throw new CAPIError("Wrong number of arguments provided for promise-based function.");
                }

                toBeCalledArguments.push(function (error, result) {
                    if (error) {
                        deferred.reject(error);
                    } else {
                        deferred.resolve(result);
                    }

                });

                originalFunction.apply(originalService, toBeCalledArguments);

                return deferred.promise;
            };
        };

        // Auto-generating promise-based functions based on every existing service function
        // taking into account all the functions with signature different from "new....Struct"
        for(key in originalService) {
            if ( (typeof originalService[key] === "function") && !(/^(new[^\s(]+Struct)/).test(key) ) {
                this[key] = this._generatePromiseFunction(originalService[key]);
            }
        }
    };

    return PromiseService;

});


/* global define */
define('PromiseCAPI',["CAPI", "services/PromiseService"], function (CAPI, PromiseService) {
    

    /**
     * Creates an instance of PromiseCAPI object based on existing CAPI object
     *
     * @class PromiseCAPI
     * @constructor
     * @param CAPI {CAPI} main REST client object
     */
    var PromiseCAPI = function (CAPI) {
        var key;

        // Documentation for dynamically created methods

        /**
         * Dynamically generated method which returns promise-based version of the ContentService.
         * Resulting service provides set of methods named the same as the regular
         * {{#crossLink "ContentService"}}ContentService{{/crossLink}} methods.
         * The only exception are structure constructors (new...Struct methods) which are not implemented in promise-based services.
         * These promise-based methods should be used without the callback parameter and according to promises approach.
         * Basic usage of a promise-based method is provided in the following example.
         * Read more about promises at https://github.com/kriskowal/q
         *
         * @method getContentService
         * @return {PromiseService}
         * @example
         *     var jsCAPI = new eZ.CAPI(
         *         'http://ez.git.local',
         *         new eZ.SessionAuthAgent({login: "admin", password: "ezpublish"}),
         *         {logRequests: true},
         *     ),
         *     jsPromiseCAPI = new eZ.PromiseCAPI(jsCAPI),
         *     promiseContentService = jsPromiseCAPI.getContentService(),
         *     promise = promiseContentService.loadSection("/api/ezp/v2/content/sections/1");
         *
         *     promise.then(
         *         function (result) {
         *             console.log(result);
         *         }, function (error) {
         *             console.log(error);
         *         }
         *     );
         */

        /**
         * Dynamically generated method which returns promise-based version of the ContentTypeService.
         * Resulting service provides set of methods named the same as the regular
         * {{#crossLink "ContentTypeService"}}ContentTypeService{{/crossLink}} methods.
         * The only exception are structure constructors (new...Struct methods) which are not implemented in promise-based services.
         * These promise-based methods should be used without the callback parameter and according to promises approach.
         * Basic usage of a promise-based method is provided in the following example.
         * Read more about promises at https://github.com/kriskowal/q
         *
         * @method getContentTypeService
         * @return {PromiseService}
         * @example
         *     var jsCAPI = new eZ.CAPI(
         *         'http://ez.git.local',
         *         new eZ.SessionAuthAgent({login: "admin", password: "ezpublish"}),
         *         {logRequests: true},
         *     ),
         *     jsPromiseCAPI = new eZ.PromiseCAPI(jsCAPI),
         *     promiseContentTypeService = jsPromiseCAPI.getContentTypeService(),
         *     promise = promiseContentTypeService.loadContentTypeGroup("/api/ezp/v2/content/typegroups/1");
         *
         *     promise.then(
         *         function (result) {
         *             console.log(result);
         *         }, function (error) {
         *             console.log(error);
         *         }
         *     );
         */

        /**
         * Dynamically generated method which returns promise-based version of the UserService.
         * Resulting service provides set of methods named the same as the regular
         * {{#crossLink "UserService"}}UserService{{/crossLink}} methods.
         * The only exception are structure constructors (new...Struct methods) which are not implemented in promise-based services.
         * These promise-based methods should be used without the callback parameter and according to promises approach.
         * Basic usage of a promise-based method is provided in the following example.
         * Read more about promises at https://github.com/kriskowal/q
         *
         * @method getUserService
         * @return {PromiseService}
         * @example
         *     var jsCAPI = new eZ.CAPI(
         *         'http://ez.git.local',
         *         new eZ.SessionAuthAgent({login: "admin", password: "ezpublish"}),
         *         {logRequests: true},
         *     ),
         *     jsPromiseCAPI = new eZ.PromiseCAPI(jsCAPI),
         *     promiseUserService = jsPromiseCAPI.getUserService(),
         *     promise = promiseUserService.loadUserGroup("/api/ezp/v2/user/groups/1/5");
         *
         *     promise.then(
         *         function (result) {
         *             console.log(result);
         *         }, function (error) {
         *             console.log(error);
         *         }
         *     );
         */

        /**
         * Array of promise-based services instances (needed to implement singletons approach)
         *
         * @attribute _services
         * @type {Array}
         * @protected
         */
        this._services = [];

        /**
         * Convert any CAPI service into Promise-based service (if needed).
         *
         * @method _getPromiseService
         * @param serviceFactoryName {String} name of the function which returns one of the CAPI services
         * @return {function} function which returns instance of the PromiseService - promise-based wrapper around any of the CAPI services
         * @protected
         */
        this._getPromiseService = function (serviceFactoryName) {
            return function () {
                if (!this._services[serviceFactoryName]) {
                    this._services[serviceFactoryName] = new PromiseService(CAPI[serviceFactoryName].call(CAPI));
                }
                return this._services[serviceFactoryName];
            };
        };

        // Auto-generating promise-based services based on every existing CAPI service
        // taking into account only functions with "get....Service" signature
        for (key in CAPI) {
            if ( (typeof CAPI[key] === "function") && (/^(get[^\s(]+Service)/).test(key) ) {
                this[key] = this._getPromiseService(key);
            }
        }
    };

    return PromiseCAPI;

});    // Exporting needed parts of the CAPI to public

    window.eZ = window.eZ || {};

    window.eZ.HttpBasicAuthAgent = require('authAgents/HttpBasicAuthAgent');
    window.eZ.SessionAuthAgent = require('authAgents/SessionAuthAgent');
    window.eZ.CAPI = require('CAPI');
    window.eZ.PromiseCAPI = require('PromiseCAPI');

}));