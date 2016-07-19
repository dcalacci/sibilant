const Sibilant = require('sibilant-webaudio')
const alert = require('alerts')
const getUserMedia = require('getusermedia')
const attachmediastream = require('attachmediastream')
const io = require('socket.io-client')
const feathers = require('feathers-client')
const $ = require('jquery')

var socket = io('https://rhythm-server.herokuapp.com', {
  'transports': [
    'websocket',
    'flashsocket',
    'htmlfile',
    'xhr-polling',
    'jsonp-polling'
  ]
})

const app = feathers()
  .configure(feathers.hooks())
  .configure(feathers.socketio(socket))
  .configure(feathers.authentication())

app.authenticate({
  type: 'local',
  email: 'heroku-email',
  password: 'heroku-password'
}).then(function (result) {
  console.log('auth result:', result)
  getUserMedia(function (err, stream) {
    if (err) {
      console.log('couldnt get user media!', err)
      alert('Sibilant couldnt get your user media. give it access to audio and try again!')
      throw err
    } else {
      console.log('got a stream!')
      socket.emit('meetingJoined', {
        participant: '0',
        name: 'Demo Participant',
        participants: ['0'],
        meeting: 'Demo Meeting'
      })

      app.service('participants').patch('0', {
        consent: true,
        consentDate: new Date().toISOString()
      })

      attachmediastream(stream, document.querySelector('#vid video'))
      document.querySelector('#vid video').muted = true
      var speakingEvents = new Sibilant(stream, {passThrough: false})
      speakingEvents.bind('speaking', function () {
        document.querySelector('#vid video').style.border = '10px solid #27ae60'
        console.log('speaking!')
      })

      speakingEvents.bind('stoppedSpeaking', function (data) {
        app.service('utterances').create(
          {
            'participant': '0',
            'meeting': 'Demo Meeting',
            'startTime': data.start.toISOString(),
            'endTime': data.end.toISOString()
          }).then(function (res) {
            console.log('speaking event recorded!', res)
            $('#info').prepend('you spoke, sent to server! <br>')
            var start = new Date(res['startTime'])
            var end = new Date(res['endTime'])
            var elapsed = new Date(end - start)
            function pad (n) {
              return String('00' + n).slice(-2)
            }
            var duration = elapsed.getMinutes() + ':' + pad(elapsed.getSeconds())
            $('#info').prepend(end.getHours() + ':' + pad(end.getMinutes()) + ':' + pad(end.getSeconds()) + '- Duration: ' + duration + '<br>')
          }).catch(function (err) {
            $('#info').prepend('ERROR: ' + err + '<br>')
            console.log('ERROR:', err)
          })
        document.querySelector('#vid video').style.border = '10px solid #555'
      })
    }
  })
})
