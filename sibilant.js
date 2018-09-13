const microevent = require('microevent');
const _ = require('lodash');

// get audio context
const AudioContextType = window.AudioContext || window.webkitAudioContext;

// f_1 band for (most) human voice range
var LOW_FREQ_CUT = 85;
var HIGH_FREQ_CUT = 583;
var bandPassMiddleFrequency = ((HIGH_FREQ_CUT - LOW_FREQ_CUT) / 2) + LOW_FREQ_CUT;
//var bandPassFrequencyRange = HIGH_FREQ_CUT - bandPassMiddleFrequency;
var Q = bandPassMiddleFrequency / (HIGH_FREQ_CUT - LOW_FREQ_CUT);

function getMaxVolume (analyser, fftBins) {
  var maxVolume = -Infinity;
  analyser.getFloatFrequencyData(fftBins);

  for(var i=4, ii=fftBins.length; i < ii; i++) {
    if (fftBins[i] > maxVolume && fftBins[i] < 0) {
      maxVolume = fftBins[i];
    }
  };

  return maxVolume;
}


// bandpass filter from AudioContext
function bandPassFilterNode (audioContext) {
  var bandpass = audioContext.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = bandPassMiddleFrequency;
  bandpass.Q = Q;
  return bandpass;
}

function speakingDetectionNode (audioContext, analyser, threshold, emitter) {
  var javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);
  var speakingTimes = [];
  var quietHistory = []; // only contains continuous 'quiet' times
  var currentVolume = -Infinity;
  var volumes = [];

  var hasStoppedSpeaking = function () {
    return (_.max(quietHistory) - _.min(quietHistory) > 250);
  };

  javascriptNode.onaudioprocess = function () {
    var fftBins = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(fftBins);
    //var maxVolume = _.max(_.filter(fftBins, function (v) { return v < 0 }));
    //currentVolume = maxVolume;
    currentVolume = getMaxVolume(analyser, fftBins);
    volumes.push({timestamp: Date.now(),
                  vol: currentVolume});
    emitter.trigger('volumeChange', currentVolume);
    // speaking, add the date to the stack, clear quiet record
    if (currentVolume > threshold) {
      emitter.trigger('speaking');
      speakingTimes.push(new Date());
      quietHistory = [];
    } else if (speakingTimes.length > 0) {
      if (hasStoppedSpeaking()) {
        emitter.trigger('stoppedSpeaking', {'start': _.min(speakingTimes), 'end': _.max(speakingTimes), 'volumes': volumes});
        volumes = [];
        speakingTimes = [];
      } else {
        quietHistory.push(new Date());
      }
    }
  };
  return javascriptNode;
}

var audioContext = null;

class Sibilant {
  constructor (stream, options) {
    options = options || {};
    var self = this;
    // var useBandPass = (options.useBandPass || true)
    this.fftSize = (options.fftSize || 512);
    this.threshold = (options.threshold || -40);
    this.smoothing = (options.smoothing || 0.2);
    this.passThrough = (options.passThrough || false);


    console.log("middle freq:", bandPassMiddleFrequency);
    console.log("range / Q:", Q);

    // Ensure that just a single AudioContext is internally created
    this.audioContext = options.audioContext || audioContext || new AudioContextType();

    this.sourceNode = null;
    this.fftBins = null;
    this.analyser = null;

    this.getStream(stream);

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = this.smoothing;
    this.fftBins = new Float32Array(this.analyser.frequencyBinCount);

    this.audioSource = this.sourceNode;

    var speakingNode = speakingDetectionNode(this.audioContext, this.analyser, this.threshold, this);
    var bandPassNode = bandPassFilterNode(this.audioContext);
    this.audioSource.connect(this.analyser);
    if (this.passThrough) {
      console.log('passing through', stream);
      this.analyser.connect(this.audioContext.destination);
    }
    this.analyser.connect(bandPassNode);
    bandPassNode.connect(speakingNode);
    // needed for chrome onprocessaudio compatibility
    speakingNode.connect(this.audioContext.destination);
  }

  getStream (stream) {
    if (stream.jquery) stream = stream[0];
    if (stream instanceof HTMLAudioElement || stream instanceof HTMLVideoElement) {
      //Audio Tag
      this.sourceNode = this.audioContext.createMediaElementSource(stream);
//      if (typeof play === 'undefined') play = true;
      this.threshold = this.threshold || -50;
    } else {
      //WebRTC Stream
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      this.threshold = this.threshold || -50;
    }
  }

  suspend () {
    this.audioContext.suspend();
  }

  resume () {
    this.audioContext.resume();
  }
}

microevent.mixin(Sibilant);

module.exports = Sibilant;
