// client-side js
// run by the browser each time your view template is loaded

// by default, you've got jQuery,
// add other scripts at the bottom of index.html
var displayType = 'closurePercent';

// keep track of the advancment of the drawing
var requestRunning = false; // if true the drowing is ongoing

$(function() {
  
  //store the data on client side, to avoid getting them after every request
  var wholeData;
  
  var socket = new WebSocket("wss://mhl-stockmarket.glitch.me/");
  
  socket.onmessage = function (event) {
    
    var msg = JSON.parse(event.data);
    
    //////////
    // INFO //
    //////////
    
    // if the server sends messages, log them
    if (msg.type == 'info'){
      console.log("info from server: " + msg.body);
    }// end info
    
    ///////////
    // ERROR //
    ///////////
    
    // if the server sends errors, log them
    if (msg.type == 'error'){
      console.log("error :" + msg.body);
    }// end error
        
    //////////
    // DATA //
    //////////
    
    // if the server sends whole data, print them
    if (msg.type == 'data'){
      
      // store the data
      wholeData = msg.body;
      
      requestRunning = true;
      // upgrade the graph
      convertData(wholeData, lineChart);
      
      // activate the X buttons
      deleteStock();
      
    }// end data
    
    /////////////////
    // DATA-SINGLE //
    /////////////////
    
    // if the server sends a single data, add it to the data and print all over again
    if (msg.type == 'data-single'){
      
      // store the data
      var newSymbol = Object.keys(msg.body)
      wholeData[newSymbol] = msg.body[newSymbol];
      
      // update the graph
      requestRunning = true;
      convertData(wholeData, lineChart);   
      
      // activate the X buttons
      deleteStock();
      
    }// end data-single
    
    ////////////
    // DELETE //
    ////////////
    
    // if the server advises that something is deleted
    if (msg.type == 'removed'){

      subSetKeys(wholeData, msg.body, function(data){
        
        // update the graph
        requestRunning = true;
        convertData(data, lineChart);

        // activate the X buttons
        deleteStock();
      });
    }// end removed

    /////////////////////////
    // CHANGE DISPLAY TYPE //
    /////////////////////////
    
    // change from percentage to value
    $('.value').on("click", function(e){
      
      // add this to prevent multiple clicks
      if (requestRunning){
        console.log('request is running')
        return;
      }
      requestRunning = true;

      // change the diplay type
      displayType = 'closure';
      
      // hide this
      $(this).addClass('hidden');
      
      // display percentage
      $('.percent').removeClass('hidden');
      
      // change subtitle
      $('header h5').html('Showing values since the begginning of the year')
      
      // update the graph
      convertData(wholeData, lineChart);   
      
      // activate the X buttons
      deleteStock();
           
    })//end change type to value
    
    // chang from value to percentage
    $('.percent').on("click", function(e){

      // add this to prevent multiple clicks
      if (requestRunning){
        console.log('request is running')
        return;
      }
      requestRunning = true;

      // change the diplay type
      displayType = 'closurePercent';
      
      // hide this
      $(this).addClass('hidden');
      
      // display value
      $('.value').removeClass('hidden');
      
      //update subtitle
      $('header h5').html('Showing percentage variation since the begginning of the year');
      
      // update the graph
      convertData(wholeData, lineChart);   
      
      // activate the X buttons
      deleteStock();
        
      
    })//end change type to percent
  } // end onmessage
  

  socket.onopen = function (event){
    
    /////////////////
    // PING SERVER //
    /////////////////
    
    // ping the server every 3 sencond to keep the ws connection going
    // don't know if it is designed to break or it is because of glitch
    function ping(){
      socket.send(JSON.stringify({
        query : 'ping',
        body: 'ping',
        date : new Date
      }))
      setTimeout(ping, 3000)
    }
    
    window.setTimeout(ping, 1000);
    
    /////////////////////////////
    // REQUIRE DATA ON CONNECT //
    /////////////////////////////
    
    // when the conenction is opened require the data
    socket.send(JSON.stringify({
      query : 'get',
      date : new Date
    }));// end data on connect
    
    ///////////////////////
    // REQUIRE NEW STOCK //
    ///////////////////////
    
    // add a new stock when the form in compiled
    $('.add-index').on("submit", function(event){
      
      event.preventDefault();
      
      // get the name of the symbol and empty the form
      var symbol = $('.in-symbol').val().toUpperCase();
      $('.in-symbol').val('');    
      $('.in-symbol').focus('');
      
      // send the request to the server
      socket.send(JSON.stringify({
        query : 'new',
        body : symbol,
        date : new Date
      }))
    });// end new stock
    
    
  }// end socket onopen

  //////////////////////////
  // REQUIRE DELETE STOCK //
  //////////////////////////
    
  function deleteStock(){
    // remove a stock from the graph
    $('.remove').on("click", function(){
  
      // get the name of the symbol
      var symbol = $(this).parent().text().slice(0, -1);

      // send a delete query to the server
      socket.send(JSON.stringify({
        query : 'delete',
        body : symbol,
        date : new Date
      }))
      
    });
  }// end deleteStock

  // take a subset of keys from object
  function subSetKeys(Obj, keys, callBack){
  
    var result = {};
  
    keys.map(function(value){
      if(Obj.hasOwnProperty(value)){
        result[value] = Obj[value];
    }  
    })
  
    wholeData = result;
    callBack(result);
  }
});

////////////////////
// DRAW THE CHART ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////

function lineChart(data){
  
  
  //-- clean up --//
  
  // empty the chart
  $(".chart").html('');
  
  // remove the tooltips
  $('.my-tooltip').remove();
  
  // remove previously written symbols
  $("div").remove('.symbol');
  
  //-------------//
  
  var height = 500
    , width = 1000
    , padding = {
                top: 50,
                right: 50,
                bottom: 50,
                left: 50
                }
    
  var chart = d3.select('.chart')
            .attr('height', height)
            .attr('width', width);
  

  var dateRange = d3.extent(data[0].values, function(val){ return val.date; }) //the date range is supposed to be the same for every index
    , minY = d3.min(data, function(d){ return d3.min(d.values, function(val){ return val[displayType]; }); })
    , maxY = d3.max(data, function(d){ return d3.max(d.values, function(val){ return val[displayType]; }); })
    , valueRange = [minY - 0.1 * (maxY - minY), maxY + 0.1 * (maxY - minY)];

  // set the scales
  var x = d3.scaleTime()
            .range([0, width - padding.left - padding.right])
            .domain(dateRange)
    , y = d3.scaleLinear()
            .range([height - padding.top - padding.bottom, 0])
            .domain(valueRange)
    , z = d3.scaleOrdinal(d3.schemeCategory10)
            .domain(data.map(d => d.index));
  
  var line = d3.line()
    .x(function(d) { return x(d.date); })
    .y(function(d) { return y(d[displayType]); });
  
  var index = chart
    .selectAll(".index")
    .data(data)
    .enter()
    .append("g") 
    .attr("class", "index")
  
  index.append("path")
      .attr("class", "line")
      .attr("d", function(d){ return line(d.values); })
      .style("stroke", function(d) { return z(d.index); })
      .attr("transform", "translate(" + padding.left + "," + padding.top + ")")
  
  //init axis
  var xAxis = d3.axisBottom()
                .scale(x)
    , yAxis = d3.axisLeft()
                .scale(y)
                .tickSize((- width + padding.left + padding.right))
      
  //draw axis
  chart.append("g")
      .attr("transform", "translate(" + padding.left + "," + (height - padding.bottom) + ")")
      .attr("class", "axis xAxis")
      .call(xAxis);
  
  chart.append("g")
      .attr("transform", "translate(" + padding.left + "," + padding.top + ")")
      .attr("class", "axis yAxis")
      .call(yAxis);
  
  
  // create pop up lines
  // first slightly modify the shape of the data
  
  convertData_2(data, function(data_2, stocks){

    // create reactive elements
    var react = chart.selectAll(".vertLine")
                .data(data_2)
                .enter()
                .append('g')
                .attr("class", "vertLine")
                .attr("transform", function(d,i){
                  return "translate(" 
                  + (padding.left + x(d[stocks[0]].date))
                  + ","
                  + 0
                  + ")";
                });
    
    react.append('rect')
          .attr("width", 1)
          .attr("height", height - padding.top - padding.bottom)
          .attr("transform", "translate(0," + padding.top + ")")
          .on('mouseenter', function(d){
      
            // hide other tooltip squares and circles
            d3.selectAll('.chart rect').style("opacity", "0");
            d3.selectAll('.chart circle').style("opacity", "0");
      
            // display current tooltip and circles
            d3.select(this).style("opacity", "1");
            d3.select(this.parentNode).selectAll('.outer').style("opacity", "0.3");
            d3.select(this.parentNode).selectAll('.inner').style("opacity", "1");
            // position a label on current event
            $('.my-tooltip').remove();
            $('main').append('<div class="my-tooltip"></div>');
            
            // define the tooltip content
            // start with date
            d3.select('.my-tooltip')
              .append('div')
              .text(d[stocks[0]].date.toDateString())
            
            // add the data of every stock
            stocks.map(function(stock){
              d3.select('.my-tooltip').append('span')
                .style('background-color', z(stock))
                .text(stock)
              
              d3.select('.my-tooltip')
                .append('span')
                .text(function(){
                  // add the data to the tooltip
                  var res = ": " + d[stock][displayType].toFixed(2);
                
                  // if the data is in percentage, add the percentage symbol
                  if (displayType == 'closurePercent'){
                    res += "%"
                  }             
                
                  return res;
                
                }).append('br')
              
            })
    
            var x = Math.round(d3.event.pageX) + "px";
            var y = (Math.round(d3.event.pageY) + 10) + "px"; // 80 is the padding of the body
          
            $('.my-tooltip').css({
              top : y,
              left : x
            })
          })   
    
    // create the small circles on selected datapoints
    stocks.map(function(stock){
      
      // append outer circle
      react.append('circle')
          .attr('class', 'outer')
          .attr("r", 10)
          .style("fill", z(stock))
          .attr("transform", function(d,i){
                    return "translate(" 
                    + "0"
                    + ","
                    + (y(d[stock][displayType]) + padding.top)
                    + ")";
          });
      
      // append inner circle
      react.append('circle')
          .attr('class', 'inner')
          .attr("r", 3)
          .style("fill", z(stock))
          .attr("transform", function(d,i){
                    return "translate(" 
                    + "0"
                    + ","
                    + (y(d[stock][displayType]) + padding.top)
                    + ")";
          });
    })
    
    // rewrite the list of symbols at the bottom of the graph
    stocks.map(function(stock){
      $('.index-list').append('<div class="symbol col col-6 text-center"'
                              + ' style = "color: ' + z(stock) + '"'
                              + '><b>' + stock + '</b><button class="remove btn">X</button></div>');
    })
  
    // signal that the drawing is finished
    requestRunning = false;

    
  })// end call: convertData_2
  

  
}// end lineChart



function convertData(data, callBack){
  
  // transform the data to use them in the graph
  // create one object for every stock with the following properties
  // index: (name of the stock)
  // values: [array of objects composed like this:
  //          {
  //          closurePercent: percentage gain in comparison to oldest data
  //          closure: value at closure for the current day
  //          date: current day
  //          }
  //          ]
  
  var parseTime = d3.timeParse("%Y%m%d");
  
  var result = [];
  
  var indices = Object.keys(data);

  result = indices.map(function(index){
    
    var firstData =  data[index].last().close;
    
    return{
          index : index,
          values : data[index].map(function(d){
            return  {
                    closurePercent: ((d.close - firstData)/ firstData) * 100, // percentage increase
                    closure : d.close, // closing value
                    date : parseTime(d.date.split('T')[0].replace(/-/g,'')) // date
                    }                
          })
    }
  })
  
  callBack(result)

} //end convertData


// rearrange the data to create the pop-up lines
function convertData_2(data, callBack){
  
  // get the list of stocks
  var stocks = data.map(function(d){
    return d.index;
  });
  
  // convert data in three arrays
  var result = data.map(function(d){
    var index = d.index
    return d.values.map(function(val){
      var tmp = {};
      tmp[index] = val;
      return tmp
    })
  })

  // convert data in one array
  var result_2 = result[0];
  
  for (var i = 0; i < result[0].length; i++){
    for (var j = 1; j < stocks.length; j++){
      result_2[i][stocks[j]] = result[j][i][stocks[j]];
    }
  }
  

  callBack(result_2, stocks);

}// end convertData_2

function checkValues(data){
  data.map(function(d, i){
    if (!d.index || !d.value || !d.date){
      console.log(i);
    }
  })

}

// add a method to select the last element of an array
if (!Array.prototype.last){
    Array.prototype.last = function(){
        return this[this.length - 1];
    };
};

