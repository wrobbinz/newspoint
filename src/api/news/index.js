import { Router } from 'express'
import rp from 'request-promise'
import _ from 'lodash'
import { newsApiSource, filteredWord } from './modules/sources'
import db from '../../queries'

const INTERVAL = 20000

export const CLOUD_SIZE = 200

// router
export default ({ config }) => {
  let news = Router()
  news.get('/', db.getAllNews)

  news.post('/', (req, res) => {
    createAllNews()
    res.json({
      status: 'success',
      message: 'Updated AllNews'
    })
  })
  return news
}

let createAllNews = (req, res) => {
  let time = Math.floor(Date.now() / 1000)
  console.log('All News Updated @ ', time, ' | Current Interval: ', INTERVAL / 1000, ' seconds')
  const sources = getSources()
  sources.then((apiResponses) => {
    // Flatten the array
    // From: [['source1article1', 'source1article2'], ['source2article1'], ...]
    // To: ['source1article1', 'source1article2', 'source2article1', ...]

    // Pass the articles as parameter
    const wordCloud = processWordBank(apiResponses)
    // Respond with the processed object
    // res.json( wordCloud )
    db.updateAllNews(wordCloud)
  })
}

// create list of words (sourceString) by pulling news data from various sources
var getSources = () => {
  return getNewsApi()
}
// NEWS API
// GET top 10 news article titles from News API (news sources are determined by the values of newsApiSource array)
var getNewsApi = () => {
  // Each element is a request promise
  const apiCalls = newsApiSource.map((source) => {
    let options = {
      uri: 'https://newsapi.org/v1/articles?source=' + source.name + '&sortBy=' + source.sort + '&apiKey=' + process.env.NEWSAPI_PASS,
      json: true
    }
    return rp(options)
      .then((res) => {
        let articles = res.articles
        // let wordObj = []
        // for (var i = 0; i < articles.length; i++){
        //   wordObj[i].article = articles[i].title + articles[i].description
        //   wordObj[i].url = articles[i].url
        // }
        // console.log(wordObj[1].article, wordObj[1].url)
        console.log(articles[1].url)

        let articleWords = _.map(articles, 'title') + _.map(articles, 'description')
        // grab the url of each article. each url needs to be associated with a word
        // let articleUrls = _.map(articles, 'url')
        // *TODO* figure out how best to map words and urls
        // The promise is fulfilled with the articleWords
        return articleWords
      })
      .catch((err) => {
        if (err) {
          console.log('Warning: NewsApi request for [', source.name, '] failed...')
        }
      })
  })
  // Return the promise that is fulfilled with all request values
  return Promise.all(apiCalls)
}

// *TODO*
// takes a string of words and array of urls, then
// var matchUrls = (words, urls) => {
//   let article = {}
// }

// clean & analyse word bank for patterns/trends
var processWordBank = (apiResponses) => {
  let wordBank = [].concat.apply([], apiResponses)
  wordBank = wordBank.join() // combine all article titles into one array element
  wordBank = refineSource(wordBank) // word cleanup
  wordBank = combineCommon(wordBank) // combine all words that appear more than once ex: "white house", "bernie sanders"
  wordBank = getWordFreq(wordBank) // get frequency of each word
  wordBank = sortToObject(wordBank[0], wordBank[1]) // convert word array and count array to object
  wordBank = wordBank.slice(0, CLOUD_SIZE) // get cream of the crop
  wordBank = normalize(wordBank) // normalize size values (so words dont get too big, and small words still show)
  return wordBank
}

var normalize = (arr) => {
  let ratio = arr[0].size / 250
  let l = arr.length
  for (var i = 0; i < l; i++) {
    arr[i].size = Math.round(arr[i].size / ratio)
  }
  return arr
}

// clean up list of words (remove unwanted chars, toLowerCase, remove undefined) and return it in array form
var refineSource = (str) => {
  var arr = str.replace(/–|"|,|!|\?|\u2022|-|—|:|' | '|\/r\/| {2}/g, ' ') // remove most special chars, replace with " "
  .replace(/\.|…|'s|[\u2018\u2019\u201A\u201B\u2032\u2035]|\|/g, '') // remove specific chars
  .split(' ') // convert to array
  .map((x) => x.toLowerCase()) // convert all elements to lowercase
  // remove all unwanted words using the filteredWord array
  for (var i = 0; i < arr.length; i++) {
    for (var j = 0; j < filteredWord.length; j++) {
      if (arr[i] === filteredWord[j]) {
        arr[i] = ''
      }
    }
  }
  // remove any items that are just empty spaces
  arr.clean('') // remove any elements that are null
  return arr
}

// find array elements that appear together more than once, if so, combine them into single element
var combineCommon = (arr) => {
  var dictionary = {}
  for (var a = 0; a < arr.length; a++) {
    var A = arr[a]
    if (dictionary[A] === undefined) {
      dictionary[A] = []
    }
    dictionary[A].push(arr[a + 1])
  }
  var res = []
  arr = clean(arr, '')
  arr = clean(arr, undefined)

  arr.clean(undefined)
  for (var index = 0; index < arr.length; index++) {
    var element = arr[index]
    var pass = false
    if (typeof dictionary[element] !== 'undefined' && dictionary[element].length > 1) {
      if (dictionary[element]
        .some((a) => {
          return a !== dictionary[element][0]
        }) === false) {
        pass = true
      }
    }
    if (pass) {
      res.push(arr[index] + ' ' + dictionary[element][0])
      index++
    } else {
      res.push(arr[index])
    }
  }
  return res
}

var getWordFreq = (arr) => {
  var a = []
  var b = []
  var prev

  arr.sort()
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] !== prev) {
      a.push(arr[i])
      b.push(1)
    } else {
      b[b.length - 1]++
    }
    prev = arr[i]
  }

  return [a, b]
}

var sortToObject = (words, count) => {
  var obj = []
  for (var i = 0; i < words.length; i++) {
    var element = {}
    element.text = words[i]
    count[i] = count[i] * 2
    element.size = count[i]
    obj.push(element)
  }
  obj.sort((a, b) => {
    return b.size - a.size
  }
  )
  // assign each pair an id (1 - ?)
  for (i = 0; i < obj.length; i++) {
    obj[i].id = i + 1
  }
  return obj
}

// utility
var clean = (arr, deleteValue) => {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] === deleteValue) {
      arr.splice(i, 1)
      i--
    }
  }
  return arr
}
setInterval(createAllNews, INTERVAL)
