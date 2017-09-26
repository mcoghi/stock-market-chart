// server.js
// where your node app starts

// init project
var express = require('express');
var app = express();

// init database
var db = require('./storage');

// init Yahoo-Finance
var yahooFinance = require('yahoo-finance');

// init Date
var date = new Date();
var month = date.getMonth() + 1;
if (month <= 10){ month = "0" + month; };

var day = date.getDate();
if (day <= 10){ day = "0" + day; }

var today = date.getFullYear() + "-" + month + "-" + day;

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

app.get("/data", function(req, res){
  
  console.log(today)
  yahooFinance.historical({
  symbols: ['GOOG', 'AAPL', 'FB'],
  from: '2017-01-01',
  to: today,
  // period: 'd'  // 'd' (daily), 'w' (weekly), 'm' (monthly), 'v' (dividends only) 
  }, function (err, quotes) {
    
    if (err) throw err;
    
    res.send(quotes);
    
  });
  
});//end get data

app.get("/today", function(req, res){
  
  yahooFinance.quote({
  symbol: 'AAPL',
  modules: [ 'price', 'summaryDetail' ] // see the docs for the full list 
  }, function (err, quotes) {
    
    if (err) throw err;
    
    res.send(quotes);
    
  });
  
})

// init web socket
var WebSocket = require('ws');
const http = require('http');

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', function connection(ws, req) {
  
  // You might use location.query.access_token to authenticate or share sessions
  // or req.headers.cookie (see http://stackoverflow.com/a/16395220/151312)

  ws.on('message', function incoming(message) {
    var msg = JSON.parse(message);
    
    /////////
    // GET //
    /////////
    
    if (msg.query == 'get'){
      
      //if a get request is received retrieve the list of indices and send it to the client
      db.getIndices({}, function(data){
        
        yahooFinance.historical({
        symbols: data.map(function(val){ return val.index }),
        from: '2017-01-01',
        to: today,
        // period: 'd'  // 'd' (daily), 'w' (weekly), 'm' (monthly), 'v' (dividends only) 
        }, function (err, quotes) { 
          
          if (err) throw err;
          
          var toSend = {
            type: 'data',
            body: quotes
          }
          
          ws.send(JSON.stringify(toSend))
        });
      })
    }// end get
    
    /////////
    // NEW //
    /////////
    
    if (msg.query == 'new'){
      
      console.log('received a new request')
      console.log(msg.body)
      // if a new stock index is give, ask yahoo for it
      yahooFinance.historical({
        symbols: [msg.body],
        from: '2017-01-01',
        to: today,
        // period: 'd'  // 'd' (daily), 'w' (weekly), 'm' (monthly), 'v' (dividends only) 
      }, function (err, quotes) { 
          
        if (err) throw err;
          
        // if the search did not return any result, send an error message
        if (quotes[msg.body].length == 0){
          
          console.log('bad search')
          ws.send(JSON.stringify({
            type : 'error',
            body : 'Invalid Symbol'
          }))
          
        } else {
          // if the search was succesful send results to every client
          
          var toSend = {
            type: 'data-single',
            body: quotes
          }
          wss.clients.forEach(function(client){
            client.send(JSON.stringify(toSend))
          })
          
          // store the search result in the database
          db.storeIndex({index : msg.body});
          
        }
        });
    } // end new
    
    ////////////
    // DELETE //
    ////////////

    if (msg.query == 'delete'){

      db.removeIndex({index : msg.body}, function(indices){
        
        // after removing and index, send the updated list to every client
        var toSend = {
            type: 'removed',
            body: indices.map(function(val){ return val.index})
          }
          wss.clients.forEach(function(client){
            client.send(JSON.stringify(toSend))
          })
      })
    }// end delete
    
    //////////
    // PONG //
    //////////
    
    // respond to ping requests with pong
    if (msg.query == 'ping'){

      ws.send(JSON.stringify({
        type : 'pong',
        body : 'pong',
        date : new Date()
      }))
    }// end ping
    
  }); // end on message

  ws.send(JSON.stringify({
    type : 'info',
    body : 'connected'
  })) 
});

// listen for requests :)
var listener = server.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
