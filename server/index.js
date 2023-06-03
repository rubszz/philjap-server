/* This code is importing necessary
   modules and setting up a server 
   using the Express framework. */
   const express = require('express');
   const cors = require('cors');
   const admin = require('firebase-admin');
   const serviceAccount = require('./firebase-config/philjaps-prod-firebase-adminsdk-g5s8r-1610e21e1c.json');
   const uuid = require('uuid');


   const app = express();
   const port = process.env.PORT || 3002;
   
   
   admin.initializeApp({
     credential: admin.credential.cert(serviceAccount),
     storageBucket: 'philjaps-prod.appspot.com',
   });
   
   const auth = admin.auth();
   const db = admin.firestore();
   const multer = require('multer');

   const bucket = admin.storage().bucket();


  // Set up multer storage engine
  /* The above code is setting up a disk storage engine for Multer, a middleware for handling file
  uploads in Node.js. It specifies the destination directory where uploaded files will be stored and
  sets the filename for the uploaded file to include the original fieldname, the current date and
  time, and the original file extension. */
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, './uploads');
    },
    filename: function (req, file, cb) {
      cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname)); // Use 'path.extname' to get the file extension
    },
  });
   
  /* `app.use(cors())` enables Cross-Origin Resource Sharing (CORS) for the Express server, allowing it
  to receive requests from other domains. `app.use(express.json())` is middleware that parses incoming
  requests with JSON payloads and makes the resulting data available on the `req.body` property of the
  request object. This allows the server to handle JSON data sent in the request body. */
  app.use(cors());
  app.use(express.json());   
   

  /**
  * This function validates a Firebase ID token in a request header and sets the decoded token as a
  * property on the request object.
  * @param req - req stands for request and it is an object that contains information about the HTTP
  * request that was made, such as the headers, body, and query parameters.
  * @param res - `res` stands for response. It is an object that represents the HTTP response that will
  * be sent back to the client. It contains information such as the status code, headers, and body of
  * the response. In this code snippet, `res` is used to send a response with a status code
  * @param next - `next` is a function that is called to pass control to the next middleware function in
  * the chain. It is typically used to move on to the next function after the current function has
  * completed its task.
  * @returns If the `authorization` header is missing or does not start with "Bearer ", a 401
  * Unauthorized response with a JSON message "Unauthorized" is returned. If the `idToken` cannot be
  * verified or decoded, a 401 Unauthorized response with a JSON message "Unauthorized" is returned.
  * Otherwise, the `decodedToken` is assigned to `req.user` and the `next()` middleware function is
  */
  const validateFirebaseIdToken = async (req, res, next) => {
    try {
      const { authorization } = req.headers;
      if (!authorization || !authorization.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const idToken = authorization.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      req.user = decodedToken;
      next();
    } catch (error) {
      console.error('Error validating Firebase ID token:', error);
      return res.status(401).json({ message: 'Unauthorized' });
    }
  };
   
  const upload = multer({ storage: multer.memoryStorage() });
  

  /* The code below is defining a route for the "/user" endpoint in an Express app. The route is
  protected by a Firebase authentication middleware called "validateFirebaseIdToken". When a GET
  request is made to this endpoint, the code retrieves the user data from a Firestore database using
  the user ID from the Firebase authentication token. If the user document does not exist, a 404 error
  is returned. If the user document exists but does not have a "firstName" field, a 404 error is
  returned. Otherwise, the user's first name is returned in the response. If there is an error
  retrieving */
  app.get('/user', validateFirebaseIdToken, async (req, res) => {
    try {
      const userSnapshot = await db
        .collection('users')
        .doc(req.user.uid)
        .get();
      if (!userSnapshot.exists) {
        console.log(`No document exists for uid: ${req.user.uid}`);
        return res.status(404).send({ message: 'User not found' });
      }
      const userData = userSnapshot.data();
      console.log(`User data: ${JSON.stringify(userData)}`); 
      if (!userData.firstName) {
        console.log(`No firstName field for uid: ${req.user.uid}`);
        return res.status(404).send({ message: 'User first name not found' });
      }
      res.send({ firstName: userData.firstName });
    } catch (error) {
      console.error('Error getting user data:', error);
      res.status(500).send({ message: 'Error getting user data' });
    }
  });
  


  /* This code defines an endpoint for user registration. When a POST request is made to the '/register'
  endpoint, the function retrieves the user's first name, last name, birthday, email, password, and
  isAdmin status from the request body. It then uses the Firebase Admin SDK to create a new user with
  the provided email and password. If the user is created successfully, it saves the user's profile
  information in Firestore and sends a response to the client with a success message and the user's
  unique ID (UID). If the user is an admin, it creates a dedicated folder for the admin user in
  Firebase Storage, sets custom Firebase Storage rules for the admin folder, and grants admin
  privileges to the user. If there is an error during the process, it sends an error response with the
  error message. */
  app.post('/register', async (req, res) => {
    const { firstName, lastName, bday, email, password, isAdmin } = req.body;
    try {
      // Create a new user
      const userRecord = await auth.createUser({
        email: email,
        password: password,
      });   
      // Save the user's profile information in Firestore
      await db.collection('users').doc(userRecord.uid).set({
        firstName: firstName,
        lastName: lastName,
        birthday: bday,
        isAdmin: isAdmin,
        email: email,
      });   
      if (isAdmin) {
        // Create a dedicated folder for the admin user in Firebase Storage
        const bucketName = 'philjaps.appspot.com'; // Replace with your storage bucket name
        const bucket = admin.storage().bucket(bucketName);
        const folderPath = `admin/${userRecord.uid}/`;
        await bucket.file(folderPath).save('');   
        // Set custom Firebase Storage rules for the admin folder
        await bucket.file('.settings/rules.json').save(
          JSON.stringify({
            rules: {
              rulesVersion: '2',
              firebaseStoragePath: {
                '.write': `root.child('${folderPath}').child(newData.path).child('metadata/admin').val() === true`,
                '.read': `root.child('${folderPath}').child(data.path).child('metadata/admin').val() === true`,
              },
            },
          })
        );   
        // Grant admin privileges to the user
        await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });
      }   
      res.send({ message: 'User registered successfully', userId: userRecord.uid });
    } catch (error) {
      console.error('Error creating new user:', error);
      res.status(500).send({ message: 'Error creating new user' });
    }
  });


  app.post('/upload', upload.array('images', 5), async (req, res) => {
    try {
      const { title, description } = req.body;
      const { files } = req;
  
      const imageUrls = await Promise.all(
        files.map(async (file) => {
          const bucket = storage.bucket();
          const imageRef = bucket.file(`images/${file.originalname}`);
          const metadata = { contentType: file.mimetype };
  
          await imageRef.save(file.buffer, { metadata });
          const [url] = await imageRef.getSignedUrl({ action: 'read', expires: '03-09-2491' });
  
          return url;
        })
      );
  
      const projectData = {
        title: title,
        description: description,
        images: imageUrls,
      };
  
      await firestore.collection('projects').add(projectData);
  
      res.status(200).json({ message: 'Upload successful' });
    } catch (error) {
      console.error('Error uploading images:', error);
      res.status(500).json({ message: 'Upload failed' });
    }
  });


  app.get('/api/users/:userId', async (req, res) => {
    const { userId } = req.params;
  
    try {
      const userSnapshot = await db.collection('users').doc(userId).get();
      const userData = userSnapshot.data();
  
      if (!userData) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      return res.json(userData);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  
  app.get('/api/projects/images/:projectId/:userId', async (req, res) => {
    const { projectId, userId } = req.params;
  
    console.log('projectId', projectId);
    console.log('userId', userId);
  
    try {
      // Fetch the project document
      const userRef = db.collection('projects').doc(userId);
      const projectRef = userRef.collection('project').doc(projectId);
      const projectDoc = await projectRef.get();
  
      if (!projectDoc.exists) {
        res.status(404).send('Project not found');
        return;
      }
  
      const projectData = projectDoc.data();
      const { title, description } = projectData;
  
      // Fetch the images for the project
      const imagesSnapshot = await projectRef.collection('images').get();
      const images = [];
  
      // Construct the response object with direct image URLs
      imagesSnapshot.docs.forEach((imageDoc) => {
        const imageData = imageDoc.data();
        const { imageUrl, imageTitle, imageDescription } = imageData;
  
        images.push({
          id: imageDoc.id,
          imageUrl,
          imageTitle,
          imageDescription,
        });
      });
  
      // Construct the response object
      const projectResponse = {
        id: projectId,
        title,
        description,
        images,
      };
  
      res.json(projectResponse);
    } catch (error) {
      console.error('Error fetching project images:', error);
      res.status(500).send('Error fetching project images');
    }
  });
  
  
  
  

  /* The code below is defining a route for a GET request to retrieve all users from a Firestore
  database. It first retrieves a snapshot of all documents in the "users" collection, then iterates
  through each document to extract its ID and data, and finally pushes an object containing the ID and
  data into an array of users. The array of users is then sent as a response with a status code of
  200. */
  app.get('/users', async (req, res) => {
    const usersSnapshot = await db.collection('users').get();
    const users = [];
    usersSnapshot.forEach(doc => {
      let id = doc.id;
      let data = doc.data();
      users.push({ id, ...data });
    });
    res.status(200).send(users);
  });

  /* The above code is defining an endpoint for a GET request to retrieve all projects for a given user
  ID. It uses Firebase Firestore to query the database for all collections under the "projects"
  document for the specified user ID. For each project collection, it retrieves all documents and
  their associated images, and constructs an array of project objects with their respective image
  objects. Finally, it sends a JSON response with the array of projects. If there are no projects
  found for the user, it sends a 404 error response. If there is an error retrieving the projects, it
  sends a 500 error response. */
  app.get('/api/projects/:userId', async (req, res) => {
    const { userId } = req.params;

    // initialize firestore
    const db = admin.firestore();

    try {
      // get projects for the user
      const userRef = db.collection('projects').doc(userId);
      const projectCollections = await userRef.listCollections();

      if (!projectCollections.length) {
        res.status(404).send('No projects found for this user');
        console.log('No matching documents.');
        return;
      }

      const projectsPromises = projectCollections.map(async (projectColl) => {
        const projectQuerySnapshot = await projectColl.get();

        const projects = projectQuerySnapshot.docs.map(async (projectDoc) => {
          const project = {
            id: projectDoc.id,
            ...projectDoc.data(),
            images: []
          };

          // get images for the project
          const imagesSnapshot = await projectDoc.ref.collection('images').get();

          imagesSnapshot.forEach(imageDoc => {
            const image = {
              id: imageDoc.id,
              ...imageDoc.data()
            };
            project.images.push(image);
          });

          return project;
        });

        return Promise.all(projects);
      });

      const projects = await Promise.all(projectsPromises).then(result => result.flat());

      res.json(projects);
    } catch (error) {
      console.error('Error getting user projects', error);
      res.status(500).send('Error getting user projects');
    }
  });

  app.post('/register', async (req, res) => {
    const { firstName, lastName, bday, email, password, isAdmin } = req.body;
    try {
      // Create a new user
      const userRecord = await auth.createUser({
        email: email,
        password: password,
      });
  
      // Save the user's profile information in Firestore
      await db.collection('users').doc(userRecord.uid).set({
        firstName: firstName,
        lastName: lastName,
        birthday: bday,
        isAdmin: isAdmin,
        email: email,
      });
  
      if (isAdmin) {
        // Create a dedicated folder for the admin user in Firebase Storage
        const bucketName = 'philjaps.appspot.com'; // Replace with your storage bucket name
        const bucket = admin.storage().bucket(bucketName);
        const folderPath = `admin/${userRecord.uid}/`;
        await bucket.file(folderPath).save('');
  
        // Set custom Firebase Storage rules for the admin folder
        await bucket.file('.settings/rules.json').save(
          JSON.stringify({
            rules: {
              rulesVersion: '2',
              firebaseStoragePath: {
                '.write': `root.child('${folderPath}').child(newData.path).child('metadata/admin').val() === true`,
                '.read': `root.child('${folderPath}').child(data.path).child('metadata/admin').val() === true`,
              },
            },
          })
        );
          
        // Grant admin privileges to the user
        await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });
      }
  
      res.send({ message: 'User registered successfully', userId: userRecord.uid });
    } catch (error) {
      console.error('Error creating new user:', error);
      res.status(500).send({ message: 'Error creating new user' });
    }
  });

  app.post('/uploadProfileImage/:userId', upload.single('profileImage'), async (req, res) => {
    const { userId } = req.params;
  
    try {
      const file = req.file;
  
      if (!file) {
        return res.status(400).json({ error: 'No profile image provided' });
      }
  
      const bucketName = 'philjaps.appspot.com'; // Replace with your storage bucket name
      const bucket = admin.storage().bucket(bucketName);
      const filePath = `profiles/${userId}/${file.originalname}`;
      const fileRef = bucket.file(filePath);
  
      await fileRef.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
        },
      });
  
      const downloadUrl = `gs://${bucketName}/${filePath}`;
  
      await db.collection('users').doc(userId).update({
        profileUrl: downloadUrl,
      });
  
      res.status(200).json({ message: 'Profile image uploaded successfully', downloadUrl });
    } catch (error) {
      console.error('Error uploading profile image:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  

  app.get('/getProfile/:userId', async (req, res) => {
    const userId = req.params.userId;
  
    try {
      const userDoc = await db.collection('users').doc(userId).get();
  
      if (!userDoc.exists) {
        throw new Error('User not found');
      }
  
      const userData = userDoc.data();
  
      return res.json({
        profileUrl: userData.profileUrl,
      });
    } catch (error) {
      console.error('Error getting user data:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
  

  app.get('/test', (req, res) => {
    res.send('Success!');
  });   
  

  /* The above code starts the server and listens on the specified port. When the server starts running,
  it will log a message to the console indicating the port number on which the server is running. */
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });   