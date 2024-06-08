const express = require('express')
const app = express()
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const jwtToken = require('jsonwebtoken')
const path = require('path')
app.use(express.json())
const dbPath = path.join(__dirname, 'twitterClone.db')
const bcrypt = require('bcrypt')
let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server is running at http:/localhost:3000/')
    })
  } catch (e) {
    console.log(e.message)
  }
}

initializeDBAndServer()



//authentictionToken

const authenticateToken = (request, response, next) => {
  let jwtToken
  const {tweet} = request.body
  const {tweetId} = request.params
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.veryfy(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.payload = payload
        request.tweetId = tweetId
        request.tweet = tweet
        next()
      }
    })
  }
}


// API 1  POST '(/register/)'

app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body
  const isRegisterueryOf = `
  SELECT  * FROM user WHERE userName = '${username}';`
  console.log(username, password, name, gender)
  const dbUser = await db.get(isRegisterueryOf)

  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      const hashedPassword = await bcrypt.hash(password, 10)
      const getCreateUserValue = `
  INSERT INTO 
      user(username, password, name, gender) 
  VALUES (
    '${username}', 
    '${hashedPassword}', 
    '${name}', 
    '${gender}'
    )`
      await db.run(getCreateUserValue)
      response.status(200)
      response.send('User created successfully')
    }
  } else {
    response.status(400)
    response.send('User already exists')
  }
})

//API 2 POST '(/login/)'

app.post('/login', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`
  console.log(username, password)
  const databaseUser = await db.get(selectUserQuery)
  if (databaseUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password,
    )
    if (isPasswordMatched === true) {
      const jwtToken = jwt.sign(databaseUser, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid Password')
    }
  }
})

//API 3  GET   '(/user/tweets/feed)'

app.get('/user/tweets/feed', authenticateToken, async (request, response) => {
  const {payload} = request
  const {userId, name, username, gender} = payload
  console.log(name)
  const getTweetsQuery = `
  SELECT 
    username,
    tweet, 
    date_time AS dateTime
  FROM
    follower INNER JOIN tweet ON follwer.following_user_id = tweet.user_id INNER JOIN user ON user.user_id = follower.following_user_id
  WHERE  
    follower.follower_user_id = ${user_id}
  OREDR BY date_time DESC
  LIMIT 4 ;`

  const tweets = await db.all(getTweetsQuery)
  response.send(tweets)
})

//API 4 GET '(/user/following/)'

app.get('/user/following/', authenticateToken, async (request, response) => {
  const {payload} = request
  const {user_id, name, username, gender} = payload
  console.log(name)
  const getFollowingUserQuery = `
  SELECT 
    name 
  FROM 
    user INNER JOIN follower ON user.user_id  =  follower.following_user_id 
  WHERE
    follower.follower_user_id = ${user_id}
    ;`
  const followingUserResult = await db.all(getFollowingUserQuery)
  response.send(followingUserResult)
})

//API 5 GET  ('/user/followers')

app.get('/user/followers', authenticateToken, async (request, response) => {
  const {payload} = request
  const {user_id, name, username, gender} = payload
  const getFollowerUserQuery = `
  SELECT 
    name 
  FROM 
    user INNER JOIN follower ON user.user_id = follower.follower_user_id 
  WHERE
    follower.following_user_id = ${user_id}
    `
  const followerUserResult = await db.all(getFollowerUserQuery)
  response.send(followerUserResult)
})

//API 6 GET  ('/user/followers')

app.get('/tweets/:tweetId', authenticateToken, async (request, response) => {
  const {tweetId} = request
  const {payload} = request
  const {user_id, name, username, gender} = payload
  console.log(name, tweetId)
  const tweetsQuery = `SELECT * FROM tweet WHERE tweet_id = ${tweetId};`
  const tweetResultOf = await db.get(tweetsQuery)
  //  response.send(tweetResultOf)
  const userFollowerQuery = `
    SELECT 
      * 
    FROM 
      follower INNER JOIN user ON user.user_id = follower.following_user_id
    WHERE
      follower.follower_user_id = ${user_id};`
  const userFollowers = await db.all(userFollowerQuery)
  //    response.send(userFollowers)

  if (
    userFollowers.some(item => item.following_user_id === tweetResultOf.user_id)
  ) {
    console.log(tweetsResult)
    console.log('-----------')
    console.log(userFollowers)
    const gtTweetDeatilsQuery = `
      SELECT 
          tweet,
          COUNT(DISTINCT(like.like_id)) AS likes,
          COUNT(DISTINCT(reply.reply_id)) AS replies,
          tweet.date_time AS dateTime
      FROM 
          tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id INNER JOIN  reply ON reply.tweet_id = tweet.tweet_id
      WHERE 
          tweet.tweet_id = ${tweetId} AND tweet.user_id = ${userFollowers[0].user_id};`

    const tweetDetails = await db.get(gtTweetDeatilsQuery)
    response.send(tweetDetails)
  } else {
    response.status(401)
    response.send('Invalid Request')
  }
})

//API 7 GET ("/tweets/:tweetId/likes/")

app.get(
  '/tweets/:tweetId/likes/',
  authenticateToken,
  async (request, response) => {
    const {tweetId} = request
    const {payload} = request
    const {user_id, name, username, gender} = payload
    console.log(name, tweetId)
    const getLikeQuery = `
  SELECT 
    *
  FROM 
    follower INNER JOIN tweet ON tweet.user_id = follower.following_user_id INNER JOIN like ON like.tweet_id = tweet.tweet_id
    INNER JOIN user ON user.user_id = like.user_id
  WHERE 
    tweet.tweet_id = '${tweetId}' AND follower.follower_user_id =  ${user_id};`

    const likedUsers = await db.all(getLikeQuery)
    consol.log(likedUsers)

    if (likedUsers.length !== 0) {
      let likes = []
      const getNameArray = likedUsers => {
        for (let item of likedUsers) {
          likes.push(item.username)
        }
      }
      getNameArray(likedUsers)
      response.send({likes})
    } else {
      response.status(401)
      response.send('Invalid Request')
    }
  },
)

//API 8 GET ("/tweets/:tweetId/replies/")

app.get(
  '/tweets/:tweetId/replies/',
  authenticateToken,
  async (request, response) => {
    const {tweetId} = request
    const {payload} = request
    const {user_id, name, username, gender} = payload
    console.log(name, tweetId)
    const getReliedQuery = `
  SELECT
   * 
  FROM 
    follower INNER JOIN tweet ON tweet.user_id = follower.following_user_id INNER JOIN reply ON reply.tweet_id = tweet.tweet_id
    INNER JOIN user ON user.user_id = reply.user_id
  WHERE 
    tweet.tweet_id = ${tweetId} AND follower.follower_user_id = ${user_id}
      ';`
    const repliedUser = await db.all(getReliedQuery)
    console.log(repliedUser)
    if (repliedUser.length !== 0) {
      let replies = []
      const getNameArray = repliedUser => {
        for (let item of repliedUser) {
          let object = {
            name: item.name,
            reply: item.reply,
          }
          replies.push(object)
        }
      }
      getNameArray(repliedUser)
      response.send({replies})
    } else {
      response.status(401)
      response.send('Invalid Request')
    }
  },
)

//API 9 GET ("/user/tweets/")

app.get('/user/tweets', authenticateToken, async (request, response) => {
  const {payload} = request
  const {user_id, name, username, gender} = payload
  console.log(name, user_id)
  const getTweetQuery = `
  SELECT tweet.tweet AS tweet,
    COUNT (DISTINCT (like.like_id)) AS likes,
    COUNT (DISTINCT (reply.reply_id)) AS replies, 
    tweet.date_time AS dateTime
  FROM
    user INNER JOIN tweet ON user.user_id = tweet.user_id INNER JOIN like ON like.tweet_id = tweet.tweet_id INNER JOIN reply ON reply.tweet_id = tweet.tweet_id
  WHERE 
    user.user_id = ${userId}
  GROUP BY tweet.tweet_id;
    `
  const tweets = await db.all(getTweetQuery)
  response.send(tweets)
})

//API 10 POST ("/user/tweets/")

app.post('/user/tweets/', authenticateToken, async (request, response) => {
  const {tweet} = request
  const {tweetId} = request
  const {payload} = request
  const {user_id, name, username, gender} = payload
  console.log(name, tweetId)
  const createTweetQuery = `
  INSERT INTO 
    tweet(tweet,user_id)
  VALUES('${tweet}', ${userId})
    `

  await db.run(createTweetQuery)
  response.send('Create a Tweet')
})

//API 11 DELETE ("/tweetId/:tweetId/")

app.delete(
  '/tweets/:tweetId/',
  authenticateToken,
  async (request, response) => {
    const {tweetId} = request
    const {payload} = request
    const {user_id, name, username, gender} = payload
    const tweetQueryOf = `
  SELECT 
    * 
  FROM 
    tweet
  WHERE 
    tweet.user_id = ${userId} AND tweet.tweet_id = ${tweetId};`
    const tweet = await db.all(tweetQueryOf)

    if (tweet.length !== 0) {
      const deleteTweetQueryOf = `
    DELETE
      FROM tweet
    WHERE 
      tweet.user_id = ${user_id} AND tweet.tweet_id = ${tweetId}
    ;`
      await db.run(deleteTweetQueryOf)
      response.send('Tweet Removed')
    } else {
      response.status(401)
      response.send('Invalid request')
    }
  },
)

module.exports = app
