const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const dbpath = path.join(__dirname, "twitterClone.db");
const app = express();
app.use(express.json());

let db = null;

const initialize = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB error:'${e.error}'`);
    process.exit(1);
  }
};

initialize();

const checkpass = (password) => {
  return password.length > 5;
};

//register
app.post("/register", async (request, response) => {
  const { username, name, password, gender } = request.body;
  const check = `SELECT * FROM user
                    WHERE username='${username}';`;

  const kk = await db.get(check);
  if (kk === undefined) {
    if (checkpass(password)) {
      const hashedpass = await bcrypt.hash(password, 10);
      const regquery = `INSERT INTO user(username,password,name,gender)
                        values('${username}','${hashedpass}','${name}','${gender}')`;

      await db.run(regquery);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});
//login

app.post("/login/", async (request, response) => {
  const { password, username } = request.body;
  const checkquery = `SELECT * FROM user
                    WHERE username='${username}';`;

  const kk = await db.get(checkquery);
  if (kk === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const check = await bcrypt.compare(password, kk.password);
    if (check) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "harinath");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//verification
const authentication = (request, response, next) => {
  const authheader = request.headers["authorization"];
  if (authheader !== undefined) {
    const jwttoken = authheader.split(" ")[1];
    jwt.verify(jwttoken, "harinath", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};

//tweets number

app.get("/user/tweets/feed", authentication, async (request, response) => {
  const { username } = request;

  const query = `SELECT following_user_id
                        FROM user 
                            Inner join follower ON
                            user.user_id=follower.follower_user_id
                           WHERE username='${username}';`;

  const kk = await db.all(query);
  const result = kk.map((each) => each["following_user_id"]);
  //response.send(kk);
  console.log(result);
  const follquery = `SELECT username,tweet,date_time as dateTime
                        FROM user
                        INNER JOIN tweet ON user.user_id=tweet.user_id
                        WHERE tweet.user_id IN (${result})
                        ORDER BY date_time DESC
                        limit 4;`;
  const data = await db.all(follquery);
  response.send(data);
});
//follodata
app.get("/user/following/", authentication, async (request, response) => {
  const { username } = request;

  const query = `SELECT following_user_id
                        FROM user 
                            Inner join follower ON
                            user.user_id=follower.follower_user_id
                           WHERE username='${username}';`;

  const kk = await db.all(query);
  const result = kk.map((each) => each["following_user_id"]);
  //response.send(kk);
  console.log(result);
  const follquery = `SELECT  name
                        FROM user                        
                        WHERE user_id IN (${result});`;

  const data = await db.all(follquery);
  response.send(data);
});
//follower
app.get("/user/followers/", authentication, async (request, response) => {
  const { username } = request;

  const query = `SELECT follower_user_id
                        FROM user 
                            Inner join follower ON
                            user.user_id=follower.following_user_id
                           WHERE username='${username}';`;

  const kk = await db.all(query);
  const result = kk.map((each) => each["follower_user_id"]);
  //response.send(kk);
  console.log(result);
  const follquery = `SELECT  name
                        FROM user                        
                        WHERE user_id IN (${result});`;

  const data = await db.all(follquery);
  response.send(data);
});
//tweetid
app.get("/tweets/:tweetId/", authentication, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const selectUserQuery = `
    SELECT * FROM user WHERE username = '${username}';
    `;
  const dbUser = await db.get(selectUserQuery);
  const getTweetQuery = `
  SELECT * FROM tweet WHERE tweet_id = ${tweetId};
  `;
  const tweetInfo = await db.get(getTweetQuery);

  const followingUsersQuery = `
    SELECT following_user_id FROM follower 
    WHERE follower_user_id = ${dbUser.user_id};
  `;
  const followingUsersObjectsList = await db.all(followingUsersQuery);
  const followingUsersList = followingUsersObjectsList.map((object) => {
    return object["following_user_id"];
  });
  if (!followingUsersList.includes(tweetInfo.user_id)) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const { tweet_id, date_time, tweet } = tweetInfo;
    const getLikesQuery = `
    SELECT COUNT(like_id) AS likes FROM like 
    WHERE tweet_id = ${tweet_id} GROUP BY tweet_id;
    `;
    const likesObject = await db.get(getLikesQuery);
    const getRepliesQuery = `
    SELECT COUNT(reply_id) AS replies FROM reply 
    WHERE tweet_id = ${tweet_id} GROUP BY tweet_id;
    `;
    const repliesObject = await db.get(getRepliesQuery);
    response.send({
      tweet,
      likes: likesObject.likes,
      replies: repliesObject.replies,
      dateTime: date_time,
    });
  }
});

/*app.get("/tweets/:tweetId/", authentication, async (request, response) => {
  const { username } = request;
  const { tweetId } = request.params;

  const query = `SELECT *
                        FROM user                            
                           WHERE username='${username}';`;

  const kk = await db.get(query);
  const query1 = `SELECT following_user_id FROM follower  
                        WHERE follower_user_id=${kk.user_id};`;
  const kk1 = await db.all(query1);
  const result = kk1.map((each) => each["following_user_id"]);
  //response.send(kk);
  console.log(result);
  const dbtweet = `SELECT user_id FROM tweet WHERE tweet_id=${tweetId}`;

  const tweetres = await db.get(dbtweet);
  console.log(tweetres);

  if (!result.includes(tweetres.user_id)) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const follquery = `SELECT  tweet,count(like_id) as likes,count(reply_id) as replies,date_time as dateTime
                        FROM tweet 
                        INNER JOIN reply on reply.user_id=tweet.user_id 
                        Inner join like on tweet.user_id=like.user_id                       
                        WHERE tweet.user_id IN (${result}) and tweet.tweet_id=${tweetId}
                        group by like_id;`;

    const data = await db.get(follquery);
    response.send(data);
  }
});*/

//likes name
app.get("/tweets/:tweetId/likes", authentication, async (request, response) => {
  const { username } = request;
  const { tweetId } = request.params;

  const query = `SELECT *
                        FROM user                            
                           WHERE username='${username}';`;

  const kk = await db.get(query);
  const query1 = `SELECT following_user_id FROM follower  
                        WHERE follower_user_id=${kk.user_id};`;
  const kk1 = await db.all(query1);
  const result = kk1.map((each) => each["following_user_id"]);
  //response.send(kk);
  console.log(result);
  const dbtweet = `SELECT user_id FROM tweet WHERE tweet_id=${tweetId}`;

  const tweetres = await db.get(dbtweet);
  console.log(tweetres);

  if (!result.includes(tweetres.user_id)) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const follquery = `SELECT username 
                        FROM like                   
                        Inner join user on user.user_id=like.user_id                      
                        WHERE tweet_id=${tweetId};`;

    const data = await db.all(follquery);
    console.log(data);
    const likedname = data.map((each) => each["username"]);
    console.log(likedname);
    response.send({ likes: likedname });
  }
});
//reply

app.get(
  "/tweets/:tweetId/replies",
  authentication,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;

    const query = `SELECT *
                        FROM user                            
                           WHERE username='${username}';`;

    const kk = await db.get(query);
    const query1 = `SELECT following_user_id FROM follower  
                        WHERE follower_user_id=${kk.user_id};`;
    const kk1 = await db.all(query1);
    const result = kk1.map((each) => each["following_user_id"]);
    //response.send(kk);
    console.log(result);
    const dbtweet = `SELECT user_id FROM tweet WHERE tweet_id=${tweetId}`;

    const tweetres = await db.get(dbtweet);
    console.log(tweetres);

    if (!result.includes(tweetres.user_id)) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const follquery = `SELECT name,reply
                        FROM reply                   
                        Inner join user on user.user_id=reply.user_id                      
                        WHERE tweet_id=${tweetId};`;

      const data = await db.all(follquery);
      console.log(data);
      const likedname = data.map((each) => each["username"]);
      console.log(likedname);
      response.send({ replies: data });
    }
  }
);

app.get("/user/tweets/", authentication, async (request, response) => {
  const { username } = request;
  const selectUserQuery = `
    SELECT * FROM user WHERE username = '${username}';
    `;
  const dbUser = await db.get(selectUserQuery);
  const { user_id } = dbUser;
  //   const user_id = 4;
  const getTweetsQuery = `
  SELECT * FROM tweet WHERE user_id = ${user_id}
  ORDER BY tweet_id;
  `;
  const tweetObjectsList = await db.all(getTweetsQuery);

  const tweetIdsList = tweetObjectsList.map((object) => {
    return object.tweet_id;
  });

  const getLikesQuery = `
    SELECT COUNT(like_id) AS likes FROM like 
    WHERE tweet_id IN (${tweetIdsList}) GROUP BY tweet_id
    ORDER BY tweet_id;
    `;
  const likesObjectsList = await db.all(getLikesQuery);
  const getRepliesQuery = `
    SELECT COUNT(reply_id) AS replies FROM reply 
    WHERE tweet_id IN (${tweetIdsList}) GROUP BY tweet_id
    ORDER BY tweet_id;
    `;
  const repliesObjectsList = await db.all(getRepliesQuery);
  console.log(tweetObjectsList);
  response.send(
    tweetObjectsList.map((tweetObj, index) => {
      const likes = likesObjectsList[index] ? likesObjectsList[index].likes : 0;
      const replies = repliesObjectsList[index]
        ? repliesObjectsList[index].replies
        : 0;
      return {
        tweet: tweetObj.tweet,
        likes,
        replies,
        dateTime: tweetObj.date_time,
      };
    })
  );
});

//post
app.post("/user/tweets/", authentication, async (request, response) => {
  const { username } = request;
  const selectUserQuery = `
    SELECT * FROM user WHERE username = '${username}';
    `;
  const dbUser = await db.get(selectUserQuery);
  const { user_id } = dbUser;
  const { tweet } = request.body;
  const dateString = new Date().toISOString();
  console.log(dateString);
  const dateTime = dateString.slice(0, 10) + " " + dateString.slice(11, 19);
  console.log(dateTime);
  const addNewTweetQuery = `
  INSERT INTO tweet (tweet, user_id, date_time) 
  VALUES ('${tweet}', ${user_id}, '${dateTime}');
  `;
  await db.run(addNewTweetQuery);
  response.send("Created a Tweet");
});
//delete

app.delete("/tweets/:tweetId/", authentication, async (request, response) => {
  const { username } = request;
  const { tweetId } = request.params;

  const query = `SELECT *
                        FROM user                            
                           WHERE username='${username}';`;

  const kk = await db.get(query);

  //response.send(kk);
  const dbtweet = `SELECT user_id FROM tweet WHERE tweet_id=${tweetId};`;

  const tweetres = await db.get(dbtweet);
  console.log(tweetres);

  if (kk.user_id !== tweetres.user_id) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const query2 = `Delete FROM tweet WHERE tweet_id=${tweetId};`;

    await db.run(query2);
    response.send("Tweet Removed");
  }
});
module.exports = app;
