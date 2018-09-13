const Sibilant = require("../")
const alert = require('alerts');
const getUserMedia = require('getusermedia');
const attachmediastream = require('attachmediastream');
const $ = require('jquery');


navigator.getUserMedia (
    // constraints
    {
        video: true,
        audio: true
    },

    // successCallback
    function(stream) {
      // var video = document.querySelector('video');
      // video.src = window.URL.createObjectURL(localMediaStream);
      // video.onloadedmetadata = function(e) {
      //     // Do something with the video here.
      // };
      attachmediastream(stream, document.querySelector('#vid video'));
      document.querySelector('#vid video').muted = true;
      var speakingEvents = new Sibilant(stream, {passThrough: false});

      console.log("whoa!", speakingEvents.volumes);

      document.querySelector('#button').addEventListener('click', function() {
        console.log("boooop")
        speakingEvents.resumeContext().then(() => {
          console.log('Playback resumed successfully');
        });
      });
        speakingEvents.bind('speaking', function () {
            document.querySelector('#vid video').style.border = '10px solid #27ae60';
            console.log('speaking!');
        });

        speakingEvents.bind('stoppedSpeaking', function (data) {
            console.log('speaking event recorded!', data.start);
            var start = new Date(data.start);
            var end = new Date(data.end);
            var duration = end - start;
            $('#info').prepend('You spoke for ' + duration + ' ms! <br>');
            document.querySelector('#vid video').style.border = '10px solid #555';
        });
    },

    // errorCallback
    function(err) {
        if(err === 'PERMISSION_DENIED') {
            alert('Sibilant couldnt get your user media. give it access to audio and try again!', err);
            console.log("error", err);
            // Explain why you need permission and how to update the permission setting
        }
    }
);
