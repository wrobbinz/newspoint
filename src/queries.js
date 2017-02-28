import promise from 'bluebird'

let options = {
  // Initialization Options
  promiseLib: promise
}

let pgp = require('pg-promise')(options);
let connectionString = 'postgres://localhost:5432/drizzly';
let db = pgp(connectionString);

// add query functions

module.exports = {
  getAllNews: getAllNews,
  updateAllNews: updateAllNews
}

function getAllNews(req, res) {
  db.any('select * from news')
    .then(function (data) {
      res.status(200)
        .json({
          status: 'success',
          data: data,
          message: 'Retrieved news for All'
        })
    })
    .catch(function (err) {
      console.log(err)
    })
}

function updateAllNews(req, res) {
	const isUpdated = req.map((item) => {
	  db.none('update news set word=$1, size=$2 where id=$3',
	    [item.text, item.size, item.id])
	    .then(function () {
	    	return res
	      // res.status(200)
	      //   .json({
	      //     status: 'success',
	      //     message: 'Updated AllNews'
	      //   })
	    })
	    .catch(function (err) {
	    	console.log(err)
	    })
		})
	return Promise.all(isUpdated)
}