// import configuration
var config = require("./credentials.js");

// init database
var mongo = require("mongodb").MongoClient;

////////////////
// GET STOCKS //
////////////////

// retrieve the indices
function getIndices(query, callBack){
   
  // connect to database
  mongo.connect(config.dbUrl, function(err, db){
    
    if (err) throw err;
    
    var collection = db.collection('stockmarket');
    
    collection.find(query).toArray(function(err, documents){
      
      if (err) throw err;
      
      callBack(documents);
      
      db.close();
      
    })
  })
}// end getIndices

///////////////
// NEW STOCK //
///////////////

// store new index
function storeIndex(query, callBack){
  
  //connect to database
  mongo.connect(config.dbUrl, function(err, db){
    
    if (err) throw err;
    
    var collection = db.collection('stockmarket');
    
    collection.find(query).toArray(function(err, documents){
      
      if (err) throw err;
      
      if (documents.length == 0){
        collection.insert(query, function(err, data){
          
           if (err) throw err;
          
          db.close();
        })
      } else {
        db.close()
      }
    }) 
  })
}// end storeIndex

//////////////////
// DELETE STOCK //
//////////////////

// delete a stock
function removeIndex(query, callBack){
  
  //connect to database
  mongo.connect(config.dbUrl, function(err,db){
    
    if (err) throw err;
    
    var collection = db.collection('stockmarket');
    
    collection.remove(query, function(err, data){
      
      if (err) throw err;
      
      // if the remove was succesfull, retrieve the updated list of stocks
      collection.find().toArray(function(err, documents){
        
        if (err) throw err;
        
        callBack(documents);
      })
    })
   })
}

module.exports = {
  getIndices : getIndices,
  storeIndex : storeIndex,
  removeIndex : removeIndex
}