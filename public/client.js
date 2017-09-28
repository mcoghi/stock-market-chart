// client-side js
// run by the browser each time your view template is loaded

// by default, you've got jQuery,
// add other scripts at the bottom of index.html
var displayType = 'closurePercent';

$(function() {
  
  //store the data on client side, to avoid getting them after every request
  var wholeData = {};
  
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
      
      e.stopImmediatePropagation()

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

function lineChart(error, data){
  
  //-- clean up --//
  
  // empty the chart
  $(".chart").html('');
  
  // remove the tooltips
  $('.my-tooltip').remove();
  
  // remove previously written symbols
  $("div").remove('.symbol');
  
  //-- handle error if database is empty --//
  if (error) throw error;
  
  //-------------//
  
  var height = 500
    , width = 1000
    , padding = {
                top: 50,
                right: 50,
                bottom: 50,
                left: 50
                }
  
  // define the cahrt
  var chart = d3.select('.chart')
            .attr('height', height)
            .attr('width', width);
  
  
  var dateRange = d3.extent(data[0].values, function(val){ return val.date; }) //the date range is supposed to be the same for every index
    , minY = d3.min(data, function(d){ return d3.min(d.values, function(val){ return val[displayType]; }); })
    , maxY = d3.max(data, function(d){ return d3.max(d.values, function(val){ return val[displayType]; }); })
    , valueRange = [minY - 0.1 * (maxY - minY), maxY + 0.1 * (maxY - minY)]; // let the graph be a bit highter (20%) than the actual y range

  // set the scales
  var x = d3.scaleTime()
            .range([0, width - padding.left - padding.right])
            .domain(dateRange)
    , y = d3.scaleLinear()
            .range([height - padding.top - padding.bottom, 0])
            .domain(valueRange)
    , z = d3.scaleOrdinal(d3.schemeCategory10)
            .domain(data.map(d => d.index));
  
  // init the line graph
  var line = d3.line()
    .x(function(d) { return x(d.date); })
    .y(function(d) { return y(d[displayType]); });
  
  // drow the line representing each stock (aka index)
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
  
  // init axis
  var xAxis = d3.axisBottom()
                .scale(x)
    , yAxis = d3.axisLeft()
                .scale(y)
                .tickSize((- width + padding.left + padding.right))
      
  // draw axis
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
    var react = chart.selectAll(".vert-line")
                .data(data_2)
                .enter()
                .append('g')
                .attr("class", "vert-line")
                .attr("transform", function(d,i){
                  return "translate(" 
                  + (padding.left + x(d[stocks[0]].date))
                  + ","
                  + 0
                  + ")";
                });
    
    // attach the grey line that covers the whole graph vertically
    react.append('rect')
          .attr("width", 1)
          .attr("height", height - padding.top - padding.bottom)
          .attr("transform", "translate(0," + padding.top + ")")          
          .on('mouseenter', function(d){
            // hide other tooltip squares and circles
            d3.selectAll('.vert-line').style("opacity", "0");
      
            // display current tooltip and circles
            d3.select(this.parentNode).style("opacity", "0.8");
            
          })
    
    // init tooltip
    var tooltipHeight = 12 * stocks.length
      , tooltipWidth = 80 + stocks.reduce(function(acc, stock){ return Math.max(acc, stock.length);}, 0) * 4
      ,  tooltip = react
                  .append('g')
                  .attr("class", "my-tooltip")
                  .attr("transform", "translate(-" + tooltipWidth/2 + "," + (padding.top - 10 * (stocks.length-1)) + ")");

    // tooltip background rectangle
    tooltip.append('rect')
      .attr("width", tooltipWidth)
      .attr("height", tooltipHeight)
      .style("fill", "lightgrey")
      .attr("transform", "translate(0," + 0 + ")")
    
    // attach the small triangle that appears under the tooltip
    tooltip.append('polygon')
          .attr("points", function(d){
            var lower = tooltipWidth/2 + "," + (tooltipHeight + 10);
            var upperRight = (tooltipWidth/2 + 5) + "," + tooltipHeight;
            var upperLeft = (tooltipWidth/2 - 5) + "," + tooltipHeight;
            
            return lower + " " + " " + upperRight + " " + upperLeft;
          }).style("fill", "lightgrey")
    
    // creating the keys of the tooltip
    var keyDim = 10;
    
    stocks.map(function(stock, i){
      tooltip.append('rect')
        .attr("width", keyDim)
        .attr("height", keyDim)
        .style("fill", z(stock))
        .attr("transform", "translate(1," + (2 + 11 * i) + ")");
    });
    
    // creating the text of the tooltip
    
    // date
    tooltip.append('text')
      .attr("y", - 1)
      .attr("dx", '.50em')
      .text(function(d){ return d[stocks[0]].date.toDateString(); });
    
    // data
    stocks.map(function(stock, i){
      tooltip.append('text').attr('x', 12).attr("y", 11 * (i+1))
        .text(function(d){
          var text = stock + ": " + d[stock][displayType].toFixed(2);
        
          // if the data is in percentage, add the percentage symbol
          if (displayType == 'closurePercent'){
            text += "%"
          }               
          
          return text
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
    
    // rewrite the interactive list of symbols at the bottom of the graph
    stocks.map(function(stock){
      $('.index-list').append('<div class="symbol col col-6 text-center"'
                              + ' style = "color: ' + z(stock) + '"'
                              + '><b>' + stock + '</b><button class="remove btn">X</button></div>');
    })
    
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
  
  // retrieve the list of stocks
  var indices = Object.keys(data);
        
  // if there are no stock, don't bother with the grapth
  if (indices.length <= 0){
    
    console.log('no stocks')
    
    callBack('no stocks to print', null);
    
    return null;
  }
  // remove dates that are not common to every stock
  
  // init the intersection as the dates of the first stock
  var intersection = data[indices[0]].map(function(value){
    
    // at the same time, filter out missing values or incomplete data
    if (value.close){
      return value.date;
    }

  })
 
  intersection = indices.reduce(function(acc, stock){
    // collect the dates of the present stock
    var new_dates = data[stock].map(function(value){
      
      // at the same time, filter out missin values or incomplete data
      if (value.close){
        return value.date;
      }
    });
    
    // intersect the two dates sets
    return acc.intersection(new_dates);    
  }, intersection)

  // compare the intersection with every stock
  // remove the non common dates

  indices.map(function(stock){
    data[stock] = data[stock].filter(function(value){
      return intersection.indexOf(value.date) >= 0;
    })
  })
  
  result = indices.map(function(index){
    
    // the oldest datum is the last one in the array
    var firstData =  data[index].last().close;
    
    return{
          index : index,
          values : data[index].map(function(d){
            return  {
                    closurePercent: ((d.close - firstData)/ firstData) * 100, // percentage variation
                    closure : d.close, // closing value
                    date : parseTime(d.date.split('T')[0].replace(/-/g,'')) // date
                    }                
          })
    }
  })
  
  callBack(null, result)

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

// add a method to select the last element of an array
if (!Array.prototype.last){
    Array.prototype.last = function(){
        return this[this.length - 1];
    };
};

// intersection of two vectors
Array.prototype.intersection = function(vector){
  return this.filter(function(value){ 
    return vector.indexOf(value) >= 0;    
  })
};
