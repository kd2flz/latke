/*
===================================================================================================================================================
  Developer Notes
===================================================================================================================================================

==================
== API REQUESTS ==
==================

API requests are POST or GET requests of dataType "JSON" and contentType "application/json"

The following members are required for all API requests (with the exception of a username & password login)
{
  "user_id": <int>,
  "token": <string>,
  "mode": <string>,
  "client": <string>,
  "device_name": <string>,
  "version": <string>
}

All responses contain the following members
{
  "result": <boolean>,
  "message": <string>,
  "settings": {
    "artwork_server": <string>,
    "streaming_server": <string>
  },
  "status": {
      "lastmodified": <date>,
      "plays": <int>,
      "available": <int>
  },
  "authenticated": <boolean>,
  "user": {
    "id": <int>,
    "email_address": <string>,
    "token": <string>,
    "session": {
      "session_uuid":<string>
    }
  }
}

If result is false, display <message> to the end user.


===============
== API MODES ==
===============

Mode determines the function of the request.

-- Login (email/password) --

Note: user_id and token are not required for this request, use this request to obtain 
the user_id/token and use that for all future requests (once "logged in")

Mode: "status"
{
  email_address: <string>,
  password: <string>
}

-- login (id/token) --

Mode: "status"
Additional fields are not required for a status request using id and token

-- Logout --

Mode: "logout"
Additional fields are not required for a logout request

-- Reset email --
Send the user a reset email request.

Mode: "reset_email"
{
  "type":"account"
  "email_address": <email_address>
}

-- Library --

Mode: "library"
Additional fields are not required for a library request. This request should go to https://library.ibroadcast.com

-- Logging playback history --
After 10 seconds of playback, the following request should be made to the server.
This should only happen once per playback.

Mode: "status"
{
  history: <history>
}

<history> contains an array of days and plays with an array of tracks as follows:
[{
  day: <date>,
  plays: {
    [<track_id>]:  <number of plays>,
  }
}]

-- Logging skip history --
Skips should logged and sent to the server using the following request

Mode: "status"
{
  history: <history>
}

<history> contains an array of days and an detail object with an array of tracks containing an event and time as follows:
[{
  day: <date format>,
  detail: {
    [<track_id>] {
    "event": "skip",
    "ts": <date>,
    }
  }
}]


===========
== LOGIN ==
===========

Logging-in consists of a few steps:
1) Authenticate the user
2) Download the user library
3) Connect to the Play Queue Server


=============
== LIBRARY ==
=============

Top level nodes returned in the library object:
  "trash"
  "artists"
  "tracks"
  "playlists"
  "tags"

Each object in the library response contains a <map> object with the array index and what its value is (i.e. title, name)

"library": {
  "<table name>": {
    "<id>": [col1...],
    "map": {
      "<column name>": <column index>,
    }
  },
  "expires": <date>
}


================
== END POINTS ==
================

JSON API: https://api.ibroadcast.com/s/JSON/<request mode>
Play Queue Server (Web Socket): wss://queue.ibroadcast.com/ws
Artwork: https://artwork.ibroadcast.com/artwork/<track_id>-<size in px (80, 150, 300)>
Library: https://library.ibroadcast.com
iBroadcast Logos: https://logo.ibroadcast.com
Streaming Server: https://streaming.ibroadcast.com (and is also provided by the status.settings object)

Generating a song URL for playback

<streaming_server><track file>?Expires=<library expires>&Signature=<token>&platform=<platform>&version=<version>&user_id=<user_id>&file_id=<track_id>

<streaming_server> URL is provided by the settings update object (settings.streaming_server)
<track file> library.tracks[track_id][library.tracks.map.file]
<library expires> is provided by the library object (library.expires)
<token> User authentication token
<platform> Platform id
<version> Platform version
<user_id> User Id
<track_id> library.tracks[track_id][library.tracks.map.id]


================
== PLAY QUEUE ==
================

The player updates its status through a WebSocket when a change is made and if there is an internet connection,
the play queue server will then send the state of this "player" to other "controllers" if they are using the same
session uuid.

When the player starts up, get_state to resume its previous state
{
  session_uuid: <session_uuid>,
  token: <token>,
  user_id: <user_id>,
  client: <client>,
  version: <version>,
  device_name: <device name>,
  local_addr: <local ip>,
  command: "get_state"
}

When the user changes play state send a set_state request to the WebSocket
{
  session_uuid: <session_uuid>,
  token: <token>,
  user_id: <user_id>,
  client: <client>,
  version: <version>,
  device_name: <device name>,
  local_addr: <local ip>,
  command: "set_state",
  value: {
    "shuffle": false,
    "volume": <0.0-1.0>,
    "pause": <boolean>,
    "tracks": <[int...]>,
    "current_song": <int>,
    "libary_last_modified": <date>,
    "start_time": <int>,
    "start_position": <int>,
    "name": <User Chosen Device name like "Jim's Computer" or "Jane's Device">,
  }
}

The WebSocket may also send requests to the "player" device.

set_state
  update local playback state with the new state received

update_library
  request and load a new library from the server.

=========================
== FUNCTIONALITY NOTES ==
=========================

· Record a play after 10 seconds into a track

· Record a skip when the user skips a track

· Authenticated in the status object must be checked in each response. If authenticated is false the user should be required to log in again.

· Album artist id 0 means the album is Various Artists (more than one artist)

· If the play button is pressed with no songs in the queue, then randomly select 500 from their library

· Trashed files should be omitted from lists and display

· Search should perform a simple wild-card search on Track name, Album name, Album artist name, and Track artist name



===================================================================================================================================================
  End Developer Notes
===================================================================================================================================================
*/



//
// ibroadcast object creation
//
function iBroadcast() {

	console.log("Start up");

	// every ibroadcast client needs its own unique device_name and client, this is where the token and session are derived from
	this.version = ".1";
	this.device_name = "Web Player (" + this.browser() + ", " + navigator.platform + ")";
	this.client = "Web Player";
};



// 
// first call
//
iBroadcast.prototype.start = function() {

	ib.log("ib.start()");


	// setup jplayer (audio player)
	ib.setupJplayer();


	// bind search input keydown
	ib.bindSearchLibrary();


	// log the user in
	ib.login();
};



//
// login, when an email_address/password is received, verify it
//
iBroadcast.prototype.login = function() {

	ib.log("ib.login()");


	// clear the UI of "what is playing" (only matters when logging out and back in)
	ib.clearUI();


	// upon login always re-create the global music object
	music = new Object();


	// make sure we reset the local playqueue object as well
	ib.state = {};
	ib.state.tracks = [];
	ib.state.data = {
		play_from: "tracls",
		play_index: 0
	};


	// if they have a cookie set, set these
	var user_id = Cookies.get('user_id');
	var token = Cookies.get('token');


	// got a user_id and token cookie, verify it with a "status" request to the json server
	if (typeof user_id != "undefined" && typeof token != "undefined") {

		ib.message("Logging in");

		ib.log(" - attemting login with user_id and token cookie");
		ib.log(" - user_id:" + user_id);
		ib.log(" - token:" + token);


		// send "status" request to the api server to authenticate user_id/token
		ib.request({

			user_id: user_id,
			token: token,
			device_name: ib.device_name,
			client: ib.client,
			version: ib.version,
			mode: "status"

		}, function(sData) {

			// success
			if (sData.result) {
		
				ib.message("Login successful, getting your music library");

				// hides login, shows library
				ib.hideLogin();

				// assign this result to local object 
				music = sData;

				// now make a request for their library 
				ib.getLibrary(sData, function() { 

					ib.message("Ready to play your music");

					// open a web socket to the pq server
					ib.openSocket(); 
				});
			}

			// request or verification failed, show login dialog
			else {

				ib.showLogin();

				ib.message("You must reauthorize this app to continue.");
		
				Cookies.set('user_id', 'logout', { expires: -1, path: '/', domain: 'demo.ibroadca.st' });
				Cookies.set('token', 'logout', { expires: -1, path: '/', domain: 'demo.ibroadca.st' });
			}
		});
	}


	// no user_id/token, but we got a login token
	else if (typeof $("#login_token").val() != "undefined" && $("#login_token").val().length > 3) {

		ib.log(" - attempting to login with login token");

	
		// request to authenticate using a login_token
		ib.request({

			login_token: $("#login_token").val(),
			device_name: ib.device_name,
			client: ib.client,
			app_id: 1000,
			version: ib.version,
			type: "account",
			mode: "login_token",
	
		}, function(sData) {

			// success
			if (sData.result) {
	
				ib.message("Login successful, getting your music library");

				// hides login, shows library
				ib.hideLogin();

				// keep the login info with cookies
				Cookies.set('user_id', sData.user.id, { expires: 365, path: '/', domain: 'demo.ibroadca.st' });
				Cookies.set('token', sData.user.token, { expires: 365, path: '/', domain: 'demo.ibroadca.st' });

				// assign this result to local object 
				music = sData;

				// now we can get their library
				ib.getLibrary(sData, function() { 

					ib.message("Ready to play your music");

					// open a web socket to the pq server
					ib.openSocket(); 
				});
			}

			// request or verification failed, show login dialog
			else {

				ib.showLogin();
	
				ib.message(sData.message);
			}
		});
	}


	// no cookie or user input, show login dialog
	else {

		ib.showLogin();
	}
};



//
// show login dialog
//
iBroadcast.prototype.showLogin = function() {

	ib.log("ib.showLogin");

	ib.message("Use your login token below once you have authorized this app");


	// show login
	$(".login").css("display","inline-block");


	// hide library ui
	$(".library").css("display","none");
};



//
// hide login dialog after logging in
//
iBroadcast.prototype.hideLogin = function() {

	ib.log("ib.hideLogin");

	// hide login
	$(".login").css("display","none");

	// show library UI
	$(".library").css("display","block");
};



//
// get a user's library from library.ibroadcast.com
//
iBroadcast.prototype.getLibrary = function(sData, callback) {

	ib.log("ib.getLibrary()");


	// send request to get library
	ib.request({

		user_id: sData.user.id,
		token: sData.user.token,
		mode: "library",

	}, function(mData) {

		if (mData.result) {

			ib.log(mData);

			// got their library, assign the library node to the global music object
			music.library = mData.library;
			music.settings = mData.settings;
			music.status = mData.status;

			// display their library in UI
			ib.showLibrary();

			// if we have a callback (usually opening a socket to the playqueue server, but there is no callback when refreshing the library on "update_library")
			if (typeof callback == "function") callback();
		} 
		
		// failed to get library, probably authentication failure, show login
		else {

			ib.message("Failed to get library");

			ib.showLogin();
		}
	});
};




//
// UI messages to the user, fade out based on length
//
iBroadcast.prototype.message = function (text) {
	
	ib.log("ib.message()");
	ib.log(" - text: " + text);

	clearTimeout(ib.messageTimer);

	$(".message_wrapper").css("display","block");
	$(".message_wrapper").css("opacity","100");

	$(".message_wrapper").click(function() {

		$(".message_wrapper").css("display","none");
	});

	$(".message").html(text);

	
	ib.messageTimer = setTimeout(function() {

		$('.message_wrapper').animate({ "opacity": "0" }, 400, function() { 

			$(".message_wrapper").css("display","none");
		});

	}, text.length * 400);
}



//
// user initiated logout AND playqueue server initiated end session 
// todo: finish end session
// 
iBroadcast.prototype.logout = function () {

	ib.log("ib.logout()");


	// clear out the UI
	ib.clearUI();


	// pause if playing
	if (!ib.isPaused()) ib.pausePlay(0);


	// clear the player of any set song 
	ib.clearMedia();


	// close the websocket 
	if (ibpq.active) ibpq.socket.close();

	
	// show login
	ib.showLogin();


	// send a logout request to server
	ib.request({

		user_id: music.user.id,
		token: music.user.token,
		mode: "logout"

	}, function(sData) {

		// set logout cookies
		Cookies.set('user_id', 'logout', { expires: -1, path: '/', domain: 'demo.ibroadca.st' });
		Cookies.set('token', 'logout', { expires: -1, path: '/', domain: 'demo.ibroadca.st' });


		// reset the global music/library object
		music = new Object();


		ib.message("You have been logged out");
	});
};




//
// opens a socket to the ibroadcast playqueue server
//
iBroadcast.prototype.openSocket = function() {

	ib.log("ib.openSocket");

	try {
		var host = "wss://queue.ibroadcast.com/ws";

		ibpq.socket = new WebSocket(host);

		ibpq.socket.onopen = function() {

			ib.log("WS opened: " + ibpq.socket.readyState);

			ib.getState();

			ibpq.active = true;
		}

		ibpq.socket.onmessage = function(msg) {

			ib.log("Message received from WS");

			// parse incoming message
			var message = JSON.parse(msg.data);

			// we need to figure the time offset from this device and the playqueue server
			if (typeof message.timestamp !== "undefined" && typeof message.start_time !== "undefined") {

				ib.log(" - timestamp: " + message.timestamp);

				// local time
				var now = new Date().getTime() / 1000;

				// figure offset from the pq server
				var time_offset = (now - message.timestamp);

				ib.log(" - time_offset: " + time_offset);
				ib.log(" - start_time: " + message.start_time);

				// adjust the start_time by the pq offset
				message.start_time = (message.start_time + time_offset);

				ib.log(" - adjusted start_time: " + message.start_time);
			}

			ib.log(" - message: " + message.message);
			ib.log(" - command: " + message.command);

			// role should always be player here, this device has no "controller" abilities
			ib.log(" - role: " + message.role);

			if (message.command == "set_state") ib.setState(message);
			if (message.command == "update_library") ib.updateLibrary(message);
		}

		ibpq.socket.onclose = function() {

			ib.log(" - socket closed, reopening");

			setTimeout(function() {
				ib.openSocket();
			}, 5000);

			ibpq.active = false;
		}

	} catch (exception) {

		ib.log(" - socket error: " + exception);

		setTimeout(function() {
			ib.openSocket();
		}, 5000);

		ibpq.active = false;
	}
};



//
// if the playqueue server tells us to update the library, then update it
//
iBroadcast.prototype.updateLibrary = function() {

	ib.log("ib.updateLibrary");

	// now get the library, no callback because the websocket should already be open
	ib.getLibrary(music);
};



//
// record a play after 10 seconds into a song
//
iBroadcast.prototype.recordPlay = function() {

	var d = new Date();
	var month = d.getMonth()+1;
	var day = d.getDate();

	var today = (month<10 ? '0' : '') + month + '-' + (day<10 ? '0' : '') + day + '-' + d.getFullYear();


	// send this obj to the json server to record a play 
	var history = [{
		day: today,
		plays: {
			[ib.getCurrentSong(ib.state)]:  1,	
		}
	}];


	// dont send it more than once 
	if (typeof ib.recordPlayTimeout !== "undefined") {

		return;
	}


	ib.log("ib.recordPlay");


	// set a 5 second timeout before we send the "play" (to avoid duplicates, this prevents this being sent more than once in a second)
	ib.recordPlayTimeout = setTimeout(function() {

		ib.log(" - sending play");

		// send a non blocking status call to ibroadcast to record this play
		ib.request({

			'user_id': music.user.id,
			'token': music.user.token,
			'mode': 'status',
			'history': history
	
		}, function(sData) {

			ib.log(sData.message);
		});

		// clear the timeout now
		clearTimeout(ib.recordPlayTimeout);

		// delete this key
		delete(ib.recordPlayTimeout);

	}, 5000);
};



//
// We record skipping songs as well
//
iBroadcast.prototype.songSkipped = function ()  {

	ib.log("ib.songSkipped()");


	// send this obj to ib to record a skip
	var history = [{
		day: ib.toMysqlFormat('date'),
		detail: {
			[ib.getCurrentSong(ib.state)]: [{
				"event": "skip",
				"ts": ib.toMysqlFormat('datetime'),
			}]
		}
	}];


	// send a non blocking status call to ibroadcast to record this play
	ib.request({

		'user_id': music.user.id,
		'token': music.user.token,
		'mode': 'status',
		'history': history

	}, function(sData) {

		ib.log(sData.message);
	});


	// next song
	ib.nextSong();
};




//
// set_state command received from pq server, normally called on logging in, loading (refreshing the browser) or when a command is sent from a controller
//
iBroadcast.prototype.setState = function(state) {

	ib.log("ib.setState()");

	// an uninitialized queue could have empty data
	if (!state.data) {
		state.data = {
			play_from: "tracks",
			play_index: 0
		}
	}

	var current_song = ib.getCurrentSong(state);

	if (current_song) {

		// the current song is the same as what is currently queued/playing locally
		if (ib.getCurrentSong(state) == ib.getCurrentSong(ib.state)) {

			// set the local state to the pq server state
			ib.state = state;

			// adjust start position
			var start_position = ib.startPosition(ib.state.start_time, ib.state.start_position);

			// set paused/play state
			if (state.pause) ib.pausePlay(start_position);
			else ib.unPausePlay(start_position);
		} 


		// song has changed
		else {
		
			// set the local state to the pq server state
			ib.state = state;


			// play the current_song, or queue it up if paused
			ib.play(undefined, state.data.play_index, state.start_time, state.start_position, state.pause);
		}

		// set local volume
		ib.setVolume(state.volume);
	}

	else {

		// nothing queued, update status
		ib.playqueueStatus();
	}
};



//
// sends the state of this player to the pq server, should be sent whenever something changes
//
iBroadcast.prototype.sendSetState = function() {

	ib.log("ib.sendSetState()");

	var params = {
		session_uuid: music.user.session.session_uuid,
		token: music.user.token,
		user_id: music.user.id,
		client:  ib.client,
		version: ib.version,
		device_name: ib.device_name,
		local_addr: "127.0.0.1", // legacy, currently unused but a value is required
		command: "set_state",
		value: {
			"shuffle": false,
			"volume": ib.getVolume(), 
		      	"pause": ib.state.pause,
			"tracks": ib.state.tracks,
			"current_song": ib.getCurrentSong(ib.state),
			"libary_last_modified": music.status.lastmodified,
			"start_time": ib.state.start_time,
			"start_position": ib.getCurrentTime(),
			"name": ib.state.name,
			"data": {
				"play_from": ib.state.data.play_from,
				"play_index": ib.state.data.play_index
			}
		}
	};

	ib.log(params);

	ibpq.socket.send(JSON.stringify(params));
};



//
// gets the state for this device from the pq server, called when we load
//
iBroadcast.prototype.getState = function() {

	ib.log("ib.getState()");

	var params = {
		session_uuid: music.user.session.session_uuid,
		token: music.user.token,
		user_id: music.user.id,
		client:  ib.client,
		version: ib.version,
		device_name: ib.device_name,
		local_addr: "127.0.0.1",
		command: "get_state",
	};

	ibpq.socket.send(JSON.stringify(params));
};



// 
// displays the user's library in the ui
//
iBroadcast.prototype.showLibrary = function() {

	ib.log("ib.showLibrary()");

	// empty so we dont append
	$(".playlists").empty();
	$(".albums").empty();


	// this does nothing if not already sorted
	ib.sortContainer("albums", function() {
	
		for (var n = 0; n < music.library.sorted.albums.length; n++) {

			var album_id = music.library.sorted.albums[n];
			var album = music.library.albums[album_id];

			// if searching, filter
			if ($(".search-input").val().length > 0) {

				if (!ib.filterContainer("albums", album)) continue;
			}

			// display the album artist name 
			var artist = (album[music.library.albums.map.artist_id] == 0)? "Various Artists" : music.library.artists[album[music.library.albums.map.artist_id]][music.library.artists.map.name];
	
			// add to ui	
			$(".albums").append("<span class='container' id='albums-" + album_id + "'><img src='/svg/icon-play.svg' onClick=\"ib.playContainer(" + album_id + ",'albums');\"><span onClick=\"ib.listTracks(" + album_id + ",\'albums\');\">" + album[music.library.albums.map.name] + " <span class='by'>by</span>" + artist + "</span></span><br>");
		}

		// now playlists
		ib.sortContainer("playlists", function() {

			for (var n = 0; n < music.library.sorted.playlists.length; n++) {

				var playlist_id = music.library.sorted.playlists[n];
				var playlist = music.library.playlists[playlist_id];

				// if searching, filter
				if ($(".search-input").val().length > 0) {

					if (!ib.filterContainer("playlists", playlist)) continue;
				}

				// add to ui
				$(".playlists").append("<span class='container' id='playlists-" + playlist_id + "'><img class='play-icon' src='/svg/icon-play.svg' onClick=\"ib.playContainer(" + playlist_id + ",\'playlists\');\"><span onClick=\"ib.listTracks(" + playlist_id + ",\'playlists\');\">" + playlist[music.library.playlists.map.name] + "</span></span><br>");
			}
		});
	});
};



//
// List tracks, displays the track listing of a container type (playlists, albums and the play queue)
//
iBroadcast.prototype.listTracks = function (container_id, container_type) {
	
	ib.log("ib.listTracks");


	// this can be called just to update (for example when searching), when that happens we can get the info from the open "window"
	if (typeof container_id == "undefined" && $(".list-tracks").length) {

		ib.log(" - container id not passed, getting from existing listing");

		container_id = $(".list-tracks").data("container_id");
		container_type = $(".list-tracks").data("container_type");
	}

	ib.log(" - container id: " + container_id);
	ib.log(" - container type: " + container_type);


	// remove so we don't append 
	$(".list-tracks").remove();


	// deref container (just for clarity)
	var container = music.library[container_type][container_id];


	// no tracks in this container
	if (!container[music.library[container_type].map.tracks] || container[music.library[container_type].map.tracks].length == 0) {

		var fTitle = container_type;
		if (fTitle.substring(fTitle.length - 1) === "s") fTitle = fTitle.substring(0, fTitle.length - 1);

		ib.message("That " + fTitle + " is empty (no tracks to list).");

		return;
	}


	// first track, we use this for artwork for this container
	var track_id = container[music.library[container_type].map.tracks][0];


	// the UI container
	$("<div/>", {

		class: "list-tracks",

	}).append( $("<img/>", {

		src: "/svg/icon-cancel-x.svg",
		class: "close",
		click: function() {

			$(".list-tracks").remove();
		}

	})).append( $("<img/>", {

		src: "https://artwork.ibroadcast.com/artwork/" + music.library.tracks[track_id][music.library.tracks.map.artwork_id] + "-150", 
		class: "list-tracks-artwork"

	})).data({ container_id: container_id, container_type: container_type }).appendTo($(".right-column"));	



	// list tracks header
	var fTitle = container_type;
	if (fTitle.substring(fTitle.length - 1) === "s") fTitle = fTitle.substring(0, fTitle.length - 1);

	var label;

	if (container_type == "albums") {

		label = (container[music.library[container_type].map.artist_id] == 0)? "Various Artists" : music.library.artists[container[music.library[container_type].map.artist_id]][music.library.artists.map.name];
	}

	if (typeof label == "undefined") {

		label = container[music.library[container_type].map.tracks].length + " tracks";

	}

	$("<div/>", {

		class: "list-tracks-header"

	}).append( $("<div/>", {

		html: fTitle,
		class: "list-tracks-header-container-type",

	})).append( $("<div/>", {

		html: container[music.library[container_type].map.name],
		class: "list-tracks-header-name",

	})).append( $("<div/>", {

		html: label,
		class: "list-tracks-header-artist",

	})).append( $("<img/>", {
		
		src: "/svg/icon-play.svg",
		class: "list-tracks-header-play",
		click: function() {

			ib.playContainer(container_id, container_type);
		}

	})).appendTo($(".list-tracks"));



	// listing the actual tracks of this container
	$("<div/>", {
		
		class: "list-tracks-list"
	
	}).appendTo($(".list-tracks"));

	
	// if a currently playing song is found in this container, then we want to scroll to it
	var scrollTo;

	for (var n = 0; n <= container[music.library[container_type].map.tracks].length; n++) {

		var track_id = container[music.library[container_type].map.tracks][n];

		if (typeof track_id == "undefined") continue;

		// skip trashed tracks
		if (music.library.tracks[track_id][music.library.tracks.map.trashed]) continue;

		if ($(".search-input").val().length > 0) {

			if (!ib.filterTrack(track_id)) continue;
		}

		var artist_id = music.library.tracks[track_id][music.library.tracks.map.artist_id];
		var artist = music.library.artists[artist_id][music.library.artists.map.name];
	
		var track = $("<div/>", {
			
			html: music.library.tracks[track_id][music.library.tracks.map.title] + "<div class='list-tracks-track-artist'>" + artist + "</div>",
			id: "trackid-" + track_id,
			class: "list-tracks-track",
			click: function() {

				ib.playContainer($(this).data("container_id"), $(this).data("container_type"), $(this).data("index"));
			}
		});

		// if these songs are in the queue, indicate that
		if (container_type != "queue" && ib.state.tracks.indexOf(track_id) !== -1) {

			track.prepend($("<div/>", {

				html: "queued",
				class: "queued"
			}));
		}

		// if this song is playing, indicate that
		if (ib.getCurrentSong(ib.state) == track_id) {
 
			scrollTo = { track_id: track_id };

			track.addClass("list-tracks-track-playing");
		}


		// we add this data to the listing so we can refresh/update it
		track.data({ container_id: container_id, container_type: container_type, index: n }).appendTo($(".list-tracks-list"));
	}


	// scroll to the currently playing song
	if (typeof scrollTo != "undefined") {

		ib.log(" - scrolling to: " + scrollTo.track_id);
		
		var elm = document.getElementById("trackid-" + scrollTo.track_id);

		if (elm) elm.scrollIntoView( true );
	}
};



//
// loads tracks into the playqueue from a container (playlist, album)
//
iBroadcast.prototype.playContainer = function (id, type, play_index) {

	ib.log("ib.playContainer");
	ib.log(" - container id:" + id);
	ib.log(" - container type:" + type);

	if (typeof play_index == "undefined") play_index = 0;

	ib.log(" - container index: " + play_index);


	// make this list global, so we can advanced to next song at the end
	if (type != "queue") {
		ib.state.tracks = music.library[type][id][music.library[type].map.tracks];
	}
	
	ib.state.data.play_index = play_index;

	// empty container
	if (typeof ib.state.tracks == "undefined" || !ib.state.tracks) {

		var fTitle = type;
		if (fTitle.substring(fTitle.length - 1) === "s") fTitle = fTitle.substring(0, fTitle.length - 1);

		ib.message("That " + fTitle + " is empty (no tracks to play).");

		return;
	}

	// play this track
	ib.play(function() { 
		
		ib.sendSetState();

		if ($(".list-tracks").length) ib.listTracks();

	 }, play_index);
};



//
// Play a track
//
iBroadcast.prototype.play = function (callback, play_index, start_time, start_position, pause) {

	ib.log("ib.play");
	ib.log(" - play_index: " + play_index);
	ib.log(" - start time: " + start_time);
	ib.log(" - start position: " + start_position);
	ib.log(" - pause: " + pause);


	// clear first, to avoid uncaught promise error in chrome, this is a specific browser function
	ib.clearMedia();

	ib.state.data.play_index = play_index;
	ib.state.data.play_from = "tracks";

	var track_id = ib.getCurrentSong(ib.state);


	// nothing to do 
	if (typeof track_id == "undefined" || !track_id) {

		ib.log(" - nothing to play");
	
		ib.playqueueStatus();

		ib.clearUI();

		return;
	}


	// remove the artwork onload handler 
	$(".artwork").off();

	var artwork_url_base = "https://artwork.ibroadcast.com/artwork/" + music.library.tracks[track_id][music.library.tracks.map.artwork_id];

	// Preload with low res
	$(".artwork").attr("src", artwork_url_base + "-80");
	$(".artwork").css("opacity",".25");
	
	// Replace with high res once loaded
	ib.artworkPreload = new Image();

	ib.artworkPreload.onload = function() {
		// image loaded here
		$(".artwork").css("opacity","1");
		$(".artwork").attr("src", artwork_url_base + "-1000");
	};

	ib.artworkPreload.src = artwork_url_base + "-1000";


	
	// let the above finish, again to avoid the promise error in chrome (jplayer does not return the promise object, so we cannot handle this properly)
	setTimeout(function() {


		// build a play url (file_id == track_id)
		var playurl = music.settings.streaming_server;
		    playurl += music.library.tracks[track_id][music.library.tracks.map.file];
		    playurl += "?Expires=" + music.library.expires;
		    playurl += "&Signature=" + music.user.token;
 		    playurl += "&platform=web&version=" + ib.version + "&user_id=" + music.user.id + "&file_id=" + track_id;
	
		ib.log(" - play url: " + playurl);

		$(".title").html(music.library.tracks[track_id][music.library.tracks.map.title]);
		$(".artist").html(music.library.artists[music.library.tracks[track_id][music.library.tracks.map.artist_id]][music.library.artists.map.name]);
		$(".album").html(music.library.albums[music.library.tracks[track_id][music.library.tracks.map.album_id]][music.library.albums.map.name]);
	
	
		// defaults, but we may get different values from the playqueue server
		if (typeof start_position == "undefined") start_position = 0;
		if (typeof start_time == "undefined") start_time = new Date().getTime() / 1000;
		if (typeof pause == "undefined") pause = false;

	
		// set the state
		ib.state.current_song = track_id;
		ib.state.name = music.library.tracks[track_id][music.library.tracks.map.title];
		ib.state.start_time = start_time;
		ib.state.start_position = start_position;


		// adjust the local start position if necessary
		start_position = ib.startPosition(start_time, start_position);

		
		// update the playqueue status in the ui
		ib.playqueueStatus();


		// set media in jplayer
		ib.setMedia(playurl);


		// song is paused, just queue it up
		if (pause) {

			ib.pausePlay(start_position);

			ib.message("Queuing " + music.library.tracks[track_id][music.library.tracks.map.title] + " by " + music.library.artists[music.library.tracks[track_id][music.library.tracks.map.artist_id]][music.library.artists.map.name]);
		} 


		// we are playing
		else {

			ib.unPausePlay(start_position);

			ib.message("Playing " + music.library.tracks[track_id][music.library.tracks.map.title] + " by " + music.library.artists[music.library.tracks[track_id][music.library.tracks.map.artist_id]][music.library.artists.map.name]);
		}


		// this callback is ib.sendSetState() to send the state to the playqueue server
		if (typeof callback == "function") callback();

	}, 100);
};



// adjusting local start time based on pq server offset
iBroadcast.prototype.startPosition = function(start_time, start_position) {

	ib.log("ib.startPosition");
	ib.log(" - start time: " + start_time);


	// start time is off by at least 3 seconds (allow some tolerance)
	if (start_time < (new Date().getTime() / 1000 + 3)) {

		ib.log(" - adjusting player start position");

		var localtime = new Date().getTime() / 1000;

		ib.log(" - local time: " + localtime);
		ib.log(" - start time: " + start_time);
		ib.log(" - start position: " + start_time);
	
		var offset = localtime - start_time;
		ib.log(" - start offset: " + offset);
	
		start_position += offset;
		ib.log(" - start position: " + start_position);

		return start_position;
	}

	else {

		ib.log(" - player start position and server start postion are the same, not adjusting");

		return start_position;
	}
};



// updates UI with the play queue information (number of songs, etc) 
iBroadcast.prototype.playqueueStatus = function() {

	ib.log("ib.playqueueStatus");


	// clear it
	$(".playqueue-status").empty();	


	// remove the click event
	$(".playqueue-status").off();	


	// queue is empty
	if (typeof ib.state.tracks == "undefined" || !ib.state.tracks.length) {

		$(".playqueue-status").html("Play queue is empty");	
	}

	// one track
	else if (ib.state.tracks.length == 1) {

		$(".playqueue-status").html("1 Track in the <u>play queue</u>.");
		$(".playqueue-status").click(function() { ib.listTracks(0, 'queue'); });

		$(".playqueue-status").append( $("<div/>", {

			html: "Clear",
			click: function(event) {

				event.stopPropagation();
				ib.clearPlayqueue();
			},
			class: "playqueue-clear"
		}));
	}	

	// more than one track in the queue
	else {

		$(".playqueue-status").html(ib.state.tracks.length + " tracks in the <u>play queue</u>.");
		$(".playqueue-status").click(function() { ib.listTracks(0, 'queue'); });

		$(".playqueue-status").append( $("<div/>", {

			html: "Clear",
			click: function(event) {

				event.stopPropagation();
				ib.clearPlayqueue();

			},
			class: "playqueue-clear"
		}));
	}

	// create a "fake" container, so we can list the playqueue's tracks
	music.library.queue = new Object();
	music.library.queue.map = music.library.albums.map;
	music.library.queue[0] = new Array();
	music.library.queue[0][music.library.queue.map.name] = "Play Queue";
	music.library.queue[0][music.library.queue.map.tracks] = ib.state.tracks;
};



// user initiated clearing of the playqueue
iBroadcast.prototype.clearPlayqueue = function() {

	ib.log("ib.clearPlayqueue");


	// make sure we don't record a play
	clearTimeout(ib.recordPlayTimeout);


	// pause the player first (we do this to reset the ui gracefully)
	ib.pausePlay(0);

	
	// clear/reset the UI
	ib.clearUI();

	
	// make sure our "fake" container has no tracks in it now
	music.library.queue[0][music.library.queue.map.tracks] = new Array();

	
	// set an empty state
	ib.state.current_song = null;
	ib.state.name = null;
	ib.state.tracks = new Array();
	ib.state.start_time = null;
	ib.state.start_position = null;
	ib.state.data.play_from = "tracks";
	ib.state.data.play_index = 0;


	// if they have the queue open, this will update/close it
	if ($('.list-tracks').length) ib.listTracks();


	// update the queue state in the ui	
	ib.playqueueStatus();	


	// send the player state to the play queue server
	ib.sendSetState();


	// again, this is to gracefully clear the media in jplayer since we don't have the promise object
	setTimeout(function() {

		ib.clearMedia();

		$(".jp-current-time").html("");
    	    	$(".jp-duration").html("");

	}, 150);

	ib.message("Play queue has been cleared");
};



// just clears up the UI, usually when logging out or clearing out the playqueue
iBroadcast.prototype.clearUI = function(opt) {

	ib.log("ib.clearUI");

	$(".title").html("Nothing Playing");
	$(".album").html("Choose something to play");
	$(".artist").html("&nbsp;");

	$(".playqueue-status").html("&nbsp;");

	// remove the onload handler from the artwork
	$(".artwork").off();

	// set artwork to iB logo
	$(".artwork").attr("src","//logo.ibroadcast.com/ibroadcast-dark-tagline.svg");
};



// pausing playback
iBroadcast.prototype.pausePlay = function(position) {

	ib.log("ib.pausePlay()");

	$('#jplayer').jPlayer("pause", position);

	ib.state.pause = true;

	ib.message("Paused");
};


// unpausing (playing)
iBroadcast.prototype.unPausePlay = function(position) {

	ib.log("ib.unPausePlay()");

	$('#jplayer').jPlayer("play", position);

	ib.state.pause = false;

	ib.message("Resume Play");
};


// if the play button is pressed with no songs in the queue, then randomly select 500 from their library
iBroadcast.prototype.randomPlay = function() {
	
	ib.log("ib.randomPlay");

	var tracks = new Array();

	for (key in music.library.tracks) {

		if (key == "map") continue;

		tracks.push(parseInt(key));
	}

	tracks = ib.shuffleArray(tracks);

	if (tracks.length > 500) {

		tracks = tracks.slice(0,500);
	}

	ib.state.tracks = tracks;
	ib.state.data.play_index = 0;

	ib.play(function() { ib.sendSetState() }, 0);
};


// this shuffles the array of songs we create with ib.randomPlay()
iBroadcast.prototype.shuffleArray = function(array) {

	var m = array.length, t, i;

	// While there remain elements to shuffle
	while (m) {

		// Pick a remaining element
		i = Math.floor(Math.random() * m--);

		// And swap it with the current element.
		t = array[m];
		array[m] = array[i];
		array[i] = t;
	}

	return array;
};



// clears jplayer of any set media, but checks if something is set first
iBroadcast.prototype.clearMedia = function() {

	if ($('#jplayer').data().jPlayer.status.src) {

		$("#jplayer").jPlayer("clearMedia");
	}
};


// sets the url 
iBroadcast.prototype.setMedia = function(url) {

	$("#jplayer").jPlayer("setMedia", { mp3: url });
};


// gets the current song ID based on the play_from and play_index
iBroadcast.prototype.getCurrentSong = function(state) {

	// queue unset thus empty
	if (!state.tracks) {
		return null;
	}

	// Need play_next for calculations
	if (!state.play_next) {
		state.play_next = [];
	}

	if (state.data.play_from == "tracks") {

		// play from tracks

		if (state.data.play_index > 0 && state.data.play_index < state.tracks.length) {
			return state.tracks[state.data.play_index];
		}
		else {
			// play_index is out of range to try to find the first track in the queue

			if (state.tracks.length > 0) {
				// first track in the queue
				return state.tracks[0];
			}
			else if (state.play_next.length > 0) {
				// return first play_next track
				return state.play_next[0];
			}
			else {
				// queue is empty, there is no current song
				return null;
			}
		}
	} else {

		// play from play_next

		// play_next always plays the first track in the list
		// after playing, that track is removed
		if (state.play_next.length > 0) {
			return state.play_next[0];
		}
		else if (state.data.play_index > 0 && state.data.play_index < state.tracks.length) {
			// default to using play_index
			return state.tracks[state.data.play_index];
		}
		else if (state.tracks.length > 0) {
			// play_index is out of range so try first track
			return state.tracks[0]
		}
		else {
			// queue is empty
			return null
		}
	}
}

// returns the current time from jplayer
iBroadcast.prototype.getCurrentTime = function ()  {

	var time = $("#jplayer").data("jPlayer").status.currentTime;

	if (typeof time == "undefined") time = 0;

	return time;
};



// checks if player is paused or playing (also returns true if no media is set)
iBroadcast.prototype.isPaused = function() {

	ib.log("ib.isPaused");

	if (!$('#jplayer').data().jPlayer.status) {

		ib.log(" - no status, player is paused");
		
		return true;
	}

	if ($('#jplayer').data().jPlayer.status.paused) {

		ib.log(" - player is paused");

		return true;
	}

	else {

		ib.log(" - player is playing");

		return false;
	}
};


// when the play button is pressed, toggle play/pause or initiate the 500 random songs if queue is empty
iBroadcast.prototype.togglePlayState = function() {

	ib.log("ib.togglePlayState()");

	//ib.log($('#jplayer').data().jPlayer.status);
	
	if (ib.isPaused()) {

		ib.log(" - unpausing");

		// no tracks in the playqueue, select 500 random songs
		if (typeof ib.state.tracks == "undefined" || ib.state.tracks.length <= 0) {

			ib.randomPlay();
			return;
		}


		ib.unPausePlay();

		ib.state.start_time = new Date().getTime() / 1000;
		ib.state.start_position = ib.getCurrentTime();
	}

	else {
		ib.log(" - pausing");

		ib.pausePlay();

		ib.state.start_time = new Date().getTime() / 1000;
		ib.state.start_position = ib.getCurrentTime();
	}

	ib.sendSetState();
};



// returns the current volume value from jplayer
iBroadcast.prototype.getVolume = function () {

	var volume = $('#jplayer').data().jPlayer.options.volume;

	return volume;
};



// sets the volume level (usually from the value we get from the playqueue server)
iBroadcast.prototype.setVolume = function (val)  {

	ib.controls.volume.slider("value", val);

	$(".jp-volume-value").html("Volume " + Math.ceil(val * 100) + "%");

	$('#jplayer').jPlayer("volume",val);
};



//
// advancing to the next song in the playqueue
//
iBroadcast.prototype.nextSong = function() {

	ib.log("ib.nextSong()");


	// clear the media first	
	ib.clearMedia();

	// since this app doesn't support play_from == "play_next", no need to switch to that queue

	// next index
	var next_index = ib.state.data.play_index + 1;

	if (next_index >= ib.state.tracks.length) {
		ib.log(" - end of tracks array reached, starting over");
		next_index = 0
	}

	ib.play(function() { 

		ib.sendSetState();	

		// update track listing if open
		if ($(".list-tracks").length) ib.listTracks();

	}, next_index, undefined, undefined, ib.state.pause);
};



//
// prev song on the playqueue
//
iBroadcast.prototype.prevSong = function() {

	ib.log("ib.prevSong()");


	// clear the media first	
	ib.clearMedia();

	// prev index
	var prev_index = ib.state.data.play_index - 1;

	if (prev_index < 0) {
		ib.log(" - beginning of tracks array reached, looping to back");
		prev_index =  ib.state.tracks.length - 1;
	}

	ib.play(function() { 

		ib.sendSetState();	

		// update track listing if open
		if ($(".list-tracks").length) ib.listTracks();

	}, prev_index, undefined, undefined, ib.state.pause);
};



//
// Formats a date string to mysql format (used for sending date stamps back to json.ibroadcast.com)
//
iBroadcast.prototype.toMysqlFormat = function(type) {

	function twoDigits(d) {
	    if(0 <= d && d < 10) return "0" + d.toString();
	    if(-10 < d && d < 0) return "-0" + (-1*d).toString();
	    return d.toString();
	}

	// formatted date
	var d = new Date();
	var month = d.getMonth()+1;
	var day = d.getDate();

	var date = d.getFullYear() + '-' + (month<10 ? '0' : '') + month + '-' + (day<10 ? '0' : '') + day;
	var time = twoDigits(d.getUTCHours()) + ":" + twoDigits(d.getUTCMinutes()) + ":" + twoDigits(d.getUTCSeconds());


	if (type === "datetime") {

		return date + " " + time;

	} else {

		return date;
	}
};



//
// Wrapper for logging to the browser console so we can easily disable logging 
//
iBroadcast.prototype.log = function (string,level) {

	// default level
	if (typeof level == "undefined") {

		console.log(string);

	} else {

		console[level](string);
	}
};



// 
// Sends rest requests to the ibroadcast json/rest server
//
iBroadcast.prototype.request = function (request,callback) {

	ib.log("ib.request()");

	// always send these
	request.client = ib.client;
	request.device_name = ib.device_name;
	request.version = ib.version;


	// rest requests here
	var url = "//api-dev.ibroadcast.com/s/JSON/" + request.mode;


	// all requests go to json server (set above), except for mode "library" that has a dedicated server
	if (request.mode == "library") url = "//library.ibroadcast.com";


	// send an json/rest request
	$.ajax({

		url: url,
		data: JSON.stringify(request),
		type: "POST",
		dataType: "json",
		success: function (res) {

			if (res.maintenance) {

				ui.alert({ text: res.message });

			} else {

				callback(res);
			}
		},
		error: function (xhr, ajaxOptions, thrownError) {
			ib.log(" - ajax error: " + JSON.stringify(xhr));
			ib.log(" - ajax error: " + thrownError);
			ib.log(" - ajax opts: " + ajaxOptions);
		}
	 });
};


//
// Creates a string used for device name
//
iBroadcast.prototype.browser = function() {

	var browser = "unknown";

	if ((!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0) browser = "Opera";

	if (typeof InstallTrigger !== 'undefined') browser = "Firefox";

	if (/constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] || safari.pushNotification)) browser = "Safari";

	if (/*@cc_on!@*/false || !!document.documentMode) browser = "Internet Explorer";

	if (!(/*@cc_on!@*/false || !!document.documentMode) && !!window.StyleMedia) browser = "IE Edge";

	if (!!window.chrome && !!window.chrome.webstore) browser = "Chrome";

	return browser;
};


//
// sets up jplayer
//
iBroadcast.prototype.setupJplayer = function() {

	ib.log("ib.setupJplayer()");


	// create a jplayer div
	$('<div/>', {
		id: "jplayer",
		class: "jp-player"

	}).appendTo('body');


	// setup jplayer
	ib.jplayer = new Object();


	// jplayer options
	ib.jplayer.options = {
		play: function (event) {
			ib.log("jplayer: play");

			$(".player-play").attr("src","/svg/btn-pause.svg");

			$(".jp-duration").html( ib.toMMSS(event.jPlayer.status.duration) );
			$(".jp-current-time").html( ib.toMMSS(event.jPlayer.status.currentTime) );
		},
		playing: function (event) {
			ib.log("jplayer: playing");
		},
		pause: function (event) {
			ib.log("jplayer: pause");

			$(".player-play").attr("src","/svg/btn-play.svg");
		},
		ended: function (event) {
			ib.log("jplayer: ended");

			ib.nextSong();
		},
		ready: function (event) {
			ib.log("jplayer: ready");

			$(".jp-volume-value").html("Volume " + Math.ceil(event.jPlayer.options.volume * 100) + "%");
		},
		seeking: function (event) {
			ib.log("jplayer: seeking");
		},
		seeked: function (event) {
			ib.log("jplayer: seeked");
		},
		timeupdate: function(event) {
			//ib.log("jplayer: timeupdate()");

			// if we are playing, we are not idle
			var d = new Date();
			ib.idleTimer = Math.round(d.getTime() / 1000);

			// time progress text label for UI
			$(".jp-current-time").html( ib.toMMSS(event.jPlayer.status.currentTime) );

			// this advances the scrubber
			ib.controls.progress.slider("value", event.jPlayer.status.currentPercentAbsolute);

			// send a playcount 10 seconds in
			if (parseInt(event.jPlayer.status.currentTime) == 10) {

				// play count
				ib.recordPlay();
			}
		},
		volumechange: function(event) {
			ib.log("jplayer: volumechange");
		},
		waiting: function (event) {
			ib.log("jplayer: waiting");
		},
		setmedia: function (event) {
			ib.log("jplayer: setmedia");

			// if we are paused, jplayer does not know the duration of the song, so use the library length info (less accurate, but better than nothing)
			if (event.jPlayer.status.duration) {

				$(".jp-duration").html( ib.toMMSS(event.jPlayer.status.duration) );

			} else {

				 $(".jp-duration").html( ib.toMMSS(music.library.tracks[ib.getCurrentSong(ib.state)][music.library.tracks.map.length]) );
			}

			$(".jp-current-time").html( ib.toMMSS(event.jPlayer.status.currentTime) );
		},
		abort: function (event) {
			ib.log("jplayer: aborted");
		},
		progress: function (event) {
			ib.log("jplayer: progress");
		},
		stalled: function (event) {
			ib.log("jplayer: stalled");
		},
		loadstart: function (event) {
			ib.log("jplayer: loadstart");
		},
		canplay: function (event) {
			ib.log("jplayer: canplay");
		},
		canplaythrough: function (event) {
			ib.log("jplayer: canplaythrough");
		},
		warning: function (event) {
			//ib.log("jplayer warning");
			//ib.log(event.jPlayer.warning);
		},
		error: function (event) {

			if (event.jPlayer.error.type === "e_no_solution") {

				ib.log("jplayer: no solution, cannot play");
				ib.log(event.jPlayer.error);
			}

			else if (event.jPlayer.error.type === "e_no_support") {

				ib.log("jplayer: no support, cannot play");
				ib.log(event.jPlayer.error);
			}

			else if (event.jPlayer.error.type === "e_url" && event.jPlayer.status.currentTime > 0) {

				ib.log("jplayer: connection reset mid-song detected, retrying");
				ib.log(event.jPlayer.error);
				ib.log(" - at time: " + event.jPlayer.status.currentTime);

				var timeReset = event.jPlayer.status.currentTime;

				$("#jplayer").jPlayer("play", (timeReset + 1));
			}

			else {
				ib.log("jplayer: an error occured");
				ib.log(event.jPlayer.error);
			}

		},
		swfPath: "/jplayer/Jplayer.swf",
		supplied: "mp3",
		//cssSelectorAncestor: "#jplayer-controls",
		solution: "html,flash",
		errorAlerts: false,
		consoleAlerts: true,
		wmode: "window",
		smoothPlayBar: true,
		volume: .8,
	};


	// set player options
	$("#jplayer").jPlayer(this.jplayer.options);



	// volume slider and scrubber controls
	ib.controls = {
		volume: $(".jp-volume-slider"),
		progress: $(".jp-progress-slider")
	};


	// time scrubber
	ib.controls.progress.slider({
		animate: "fast",
		max: 100,
		range: "min",
		step: 0.1,
		value : 0,
		slide: function(e, u) {

			ib.log("Adjusting the scrubber/slider");
			ib.log(" - " + u.value + "%");

			var sp = $('#jplayer').data('jPlayer').status.seekPercent;

			if (sp > 0) {

				// Move the play-head to the value and factor in the seek percent.
				$('#jplayer').jPlayer("playHead", u.value * (100 / sp));

			} else {

				// Create a timeout to reset this slider to zero.
				setTimeout(function() {
					ib.controls.progress.slider("value", 0);
				}, 10);
			}

			clearTimeout(ib.scrubberTimeout);

			ib.state.start_time = new Date().getTime() / 1000;
			ib.start.start_position = ib.getCurrentTime();

			setTimeout(function() {

				ib.sendSetState();

			}, 100);
		}
	});


	// volume slider
	ib.controls.volume.slider({
		orientation: 'horizontal',
		animate: "fast",
		max: 1,
		range: "min",
		step: 0.01,
		value : $('#jplayer').jPlayer("option", "volume"),
		slide: function(e, u) {

			ib.log("Adjusting the volume slider: " + u.value);

			$('#jplayer').jPlayer("option", "volume", u.value);

			$(".jp-volume-value").html("Volume " + Math.ceil(u.value * 100) + "%");

			ib.sendSetState();
		}
	});
};



//
// this formats the scrubber time to MM::SS in the UI 
//
iBroadcast.prototype.toMMSS = function (num) {

	//ib.log("ib.toMMSS()");
	//ib.log(" - raw: " + num);

	var sec_num = parseInt(num);
	var minutes = Math.floor(sec_num / 60);
	var seconds = sec_num - (minutes * 60);

	if (minutes < 10) {minutes = "0"+minutes;}
	if (seconds < 10) {seconds = "0"+seconds;}

	var f = minutes + ":" + seconds;

	//ib.log(" - formatted: " + f);

	return(f);
};


//
// this sorts containers, not the track listing in each container, the container names, we use this for both playlists and albums as they are objects
//
iBroadcast.prototype.sortContainer = function (container, callback) {

	ib.log("ib.sortContainer()");
	ib.log(" - container: " + container);


	// make sure sorted object exists, we put sorted arrays here
	if (typeof music.library.sorted == "undefined") music.library.sorted = new Object();


	// already sorted, to re-sort, delete this key
	if (typeof music.library.sorted[container] !== "undefined") {

		ib.log(" - already sorted, returning");

		callback();

		return;
	}


	// array to sort
	var array = new Array();


	// get rid of trashed containers
	var tArray = Object.keys(music.library[container]);

	for (var n = 0; n < tArray.length; n++) {

		if (tArray[n] !== "map" && container !== "playlists" && music.library[container][tArray[n]][music.library[container].map.tracks].length <= 0) continue;

		if (music.library[container][tArray[n]][music.library[container].map.trashed]) continue;

		array.push(tArray[n]);
	}


	// remove map
	array.splice(array.indexOf('map'), 1);


	// sort
	var sorted = array.sort(function(a,b) {

		if (!music.library[container][a][music.library[container].map.name]) return 0;
		if (!music.library[container][b][music.library[container].map.name]) return 0;

		return music.library[container][a][music.library[container].map.name].localeCompare(music.library[container][b][music.library[container].map.name]);
	});

	
	// assign it
	music.library.sorted[container] = sorted;


	ib.log(" - done sorting: " + container);


	callback();
};



//
// bind the search input field to filter library
//
iBroadcast.prototype.bindSearchLibrary = function() {

	ib.log("ib.bindSearchLibrary()");

	$(".search-input").unbind();

	// key bindings for searching
	$(".search-input").keyup(function(event) {

		if ($(".search-input").val().length > 0) {

			$(".search-clear").css({ display: 'inline' });

		} else if ($(".search-input").val().length <= 0) {

			$(".search-clear").css({ display: 'none' });
		}


		// create "clear search" icon/button
		if ($(".search-input").val().length > 0) $(".search-clear").css({ display: 'inline' });
		else if ($(".search-input").val().length <= 0)  $(".search-clear").css({ display: 'none' });


		// use this for the delay between stopping search, and displaying results
		if (typeof ib.search === "undefined") {

			ib.search = new Object();
			ib.search.timeout = false;

			// number of miliseconds to wait after last key stroke to display results
			ib.search.delta = 500;
		}


		// (re)set this for each key stroke
		ib.search.tTime = new Date();


		// start the wait now
		if (ib.search.timeout === false) {

			ib.search.timeout = true;

			setTimeout(function() {
				typeEnd();

			}, ib.search.delta);
		}


		function typeEnd() {

			// make sure our "delta" time has elapsed
			if ((new Date() - ib.search.tTime) <= ib.search.delta) {

				setTimeout(function() {
					typeEnd();
				}, ib.search.delta);
			}

			// ok, the delta has elapsed, show filtered music
			else {

				if ($(".list-tracks").length) {

					ib.showLibrary();

					ib.listTracks();

				} else {

					ib.showLibrary();
				}

				// resets the timeout
				ib.search.timeout = false;
			}
		}
	});
};



//
// user initated "clear search"
//
iBroadcast.prototype.clearSearch = function() {

	$(".search-input").val('');

	$(".search-clear").css({ display: 'none' });

	if ($(".list-tracks").length) {

		ib.showLibrary();

		ib.listTracks();

	} else {

		ib.showLibrary();
	}
};



//
// when a search string is active, we use this to filter containers
//
iBroadcast.prototype.filterContainer = function (container_type, container) {

	//ib.log("ib.filterContainer");

	var pattern = new RegExp($('.search-input').val(),'i');

	// check container name first, fastest
	if (pattern.test(container[music.library[container_type].map.name])) {

		//ib.log(" - container name match: " + container[music.library[container_type].map.name]);

		return true;
	}

	// must check container tracks now, title, artist and album
	for (t in container[music.library[container_type].map.tracks]) {

		// track id
		var track_id = container[music.library[container_type].map.tracks][t];

		if (ib.filterTrack(track_id)) return true; 
	}

	return false;
};



//
// when a search string is active, we use this to filter tracks
//
iBroadcast.prototype.filterTrack = function (track_id) {

	//ib.log("ib.filterTrack()");

	var pattern = new RegExp($('.search-input').val(),'i');


	// track name
	if (pattern.test(music.library.tracks[track_id][music.library.tracks.map.title])) return true;


	// artist id
	var artist_id = music.library.tracks[track_id][music.library.tracks.map.artist_id];


	// check artist name
	if (pattern.test(music.library.artists[artist_id][music.library.artists.map.name])) return true;


	// album id
	var album_id = music.library.tracks[track_id][music.library.tracks.map.album_id];


	// check album name
	if (pattern.test(music.library.albums[album_id][music.library.albums.map.name])) return true;


	return false;
};



//
// forgot password dialog
//
iBroadcast.prototype.forgotPassword = function () {

	ib.log("ib.forgotPassword");

	$("<div/>", {

		html: "Enter your email address below and we will send you an email with a link to reset your password.<br><br> <input type='text' name='email_address' style='width: 100%;' id='reset-email' placeholder='Your email address.'>",

	}).dialog({

		modal: true,
		resizable: false,
		title: "Forgot Password",
		draggable: false,
		buttons: {

			'Send Reset Email': function () {
	
				var isValid = ib.validateEmail( $('#reset-email').val() );

				$(this).dialog("close");

				if (isValid) {

					ib.sendResetEmail( $('#reset-email').val() );
				}

				else {

					$("<div/>", {

						html: "That is not a valid email address.",
	
					}).dialog({

				       		modal: true,
						resizable: false,
						title: "Error",
						draggable: false,
						open: function(event, ui) { $(".ui-dialog-titlebar-close").hide(); },
						buttons: {
							'Ok': function () {

								$(this).dialog("close");
								ib.forgotPassword();
							}
						},
					});
				}
			},
			'Cancel': function () {
				$(this).dialog("close");
			}
		},
		close: function (event, ui) {
			$(this).dialog("close");
		}
	});
};



//
// send reset email to user upon request
//
iBroadcast.prototype.sendResetEmail = function (email) {

	ib.log("Sending reset email");
	ib.log(" - to: " + email);


	$("<div/>", {

		html: "<div class='mgr-wait'><img src='/images/waiting.gif'></div>",

	}).dialog({

       		modal: true,
		resizable: false,
		title: "Sending",
		draggable: false,
		open: function(event, ui) { $(".ui-dialog-titlebar-close").hide(); },
	});


	// send it to ib
	ib.request({ 

		'mode':'reset_email',
		'type':'account',
		'email_address': email 

	}, function(sData) {

		ib.log(" - got verification response");

		$(".ui-dialog").remove();

		$("<div/>", {

			html: sData.message,
		
		}).dialog({
		
       			modal: true,
			resizable: false,
			title: "Recover Password",
			draggable: false,
			buttons: {

				'Ok': function () {

					$(this).dialog("close");

					if (!sData.result) ib.forgotPassword();
				}
			}
		});
	});
};



//
// validate an email address (regex)
//
iBroadcast.prototype.validateEmail = function (email) {

	ib.log("ib.validateEmail()");
	ib.log(" - email: " + email);

	var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

	ib.log(" - result: " + re.test(email));

	return re.test(email);
};
