const Sibilant = require('../sibilant.js')
const alert = require('alerts')
const getUserMedia = require('getusermedia')
const attachmediastream = require('attachmediastream')

getUserMedia(function (err, stream) {
  if (err) {
    console.log('couldnt get user media!', err)
    alert('Sibilant couldnt get your user media. give it access to audio and try again!')
    throw err
  } else {
    console.log('got a stream!')
    attachmediastream(stream, document.querySelector('#vid video'))
    document.querySelector('#vid video').muted = true
    var speakingEvents = new Sibilant(stream, {passThrough: false})
    speakingEvents.bind('speaking', function () {
      document.querySelector('#vid video').style.border = '10px solid #27ae60'
      console.log('speaking!')
    })

    speakingEvents.bind('stoppedSpeaking', function (data) {
      document.querySelector('#vid video').style.border = '10px solid #555'
    })
  }
})

var ronson = document.querySelector('#ronson audio')
console.log(ronson)
var ronsonSpeakingEvents = new Sibilant(ronson, {passThrough: true})
ronsonSpeakingEvents.bind('speaking', function () {
  document.querySelector('#ronson').style.border = '10px solid #27ae60'
  console.log('speaking!')
})

ronsonSpeakingEvents.bind('stoppedSpeaking', function (data) {
  document.querySelector('#ronson').style.border = '10px solid #555'
  console.log('stopped speaking!')
})
