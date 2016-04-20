var WebSocket = require('ws');
var ws = new WebSocket('ws://127.0.0.1:8080');

ws.on('open', function open(){
  ws.send('client something');
});

ws.on('message', function(data, flags){
  console.log(data);
  console.log(flags);
  ws.close();
});
