var mockData = {
  "latitude": "30.58",
  "longitude": "114.27",
  "countrycode": "CN",
  "country": "CN",
  "city": "武汉",
  "org": "中国湖北省网络",
  "latitude2": "38.62",
  "longitude2": "-90.35",
  "countrycode2": "US",
  "country2": "US",
  "city2": "洛杉矶",
  "type": "ipviking.honey",
  "md5": "221.235.189.244",
  "dport": "21",
  "zerg": "rush"
};

var WebSocketServer = require('ws').Server,
  wss = new WebSocketServer({
    port: 9999
  });

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    console.log('received: %s', message);
  });

  ws.send(JSON.stringify(mockData));
  ws.close();
});
