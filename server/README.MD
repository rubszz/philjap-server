# Express Server with Firebase Integration

## Overview:
This is an Express server application that interacts with Firebase for authentication and Firestore for data storage. The server application provides several endpoints for user registration, authentication, and data retrieval.

## Dependencies:

- **Express:** A web application framework for Node.js, used to build web applications and APIs.
- **CORS:** Middleware to enable Cross-Origin Resource Sharing.
- **Firebase Admin SDK:** A server-side module for interacting with Firebase, which provides interfaces for authentication and data storage.

## Initialization:
The server initializes Firebase Admin SDK using a service account key file, sets up Firestore as the database, and enables CORS and JSON body parsing middleware for Express.

## Middleware:

- **verifyIdToken:** Middleware that verifies a Firebase ID token provided in the `Authorization` header of a request. If the token is valid, it extracts the user ID from the token and passes it to the next middleware or route handler.
- **validateFirebaseIdToken:** Middleware that validates a Firebase ID token in a request header and sets the decoded token as a property on the request object.

## Endpoints:

- **GET /user/:userId/conversations:** Endpoint for retrieving a user's conversation history from Firestore.
- **POST /signup:** Endpoint for user signup, which creates a new user with an email and password using Firebase Admin SDK.
- **GET /user:** Endpoint for retrieving a user's first name from Firestore.
- **POST /register:** Endpoint for user registration, which creates a new user and saves the user's profile information in Firestore.
- **GET /getImage/:imageName:** Endpoint for retrieving a signed URL for a file stored in Firebase Cloud Storage.
- **GET /test:** Test endpoint that returns a success message.

## Server Startup:
The server listens for connections on a specified port and logs a message to the console when it starts running.

## Error Handling:
The application includes error handling for Firebase authentication, Firestore data retrieval, and invalid request data. Errors are logged to the console and appropriate HTTP status codes and error messages are sent in the response.

## Running the ExpressJS Server
   - <code>npm install</code>
   - <code>npm run server</code>

     useEffect(() => {
    const fetchReceiverEmail = async () => {
      try {
        const userDoc = await firestore.collection('users').doc(userId).get();
        const userData = userDoc.data();
        if (userData && userData.email) {
          setTo(userData.email);
        }
      } catch (error) {
        console.error('Error fetching receiver email:', error);
      }
    };

    if (userId) {
      fetchReceiverEmail();
    }
  }, [userId]);

import React, { useState } from 'react';
import emailjs from 'emailjs-com';
import classnames from 'classnames';

const EmailForm = () => {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'to') {
      setTo(value);
    } else if (name === 'subject') {
      setSubject(value);
    } else if (name === 'text') {
      setText(value);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSending(true);

    // Configure emailjs with your user ID and email service ID
    emailjs.init('4b35hCQFivBvVPHWY');

    // Prepare the email parameters
    const emailParams = {
      to_email: to,
      subject,
      message: text,
    };

    // Send the email using emailjs
    emailjs
      .send('service_zjcigin', 'template_ft1grju', emailParams)
      .then(() => {
        setIsSent(true);
        setError(null);
      })
      .catch((error) => {
        setIsSent(false);
        setError('An error occurred while sending the email');
        console.error('Error sending email:', error);
      })
      .finally(() => {
        setIsSending(false);
      });
  };

  return (
    <div className="max-w-md p-6 mx-auto text-white bg-gray-900 rounded-lg shadow-lg">
      <h2 className="mb-4 text-2xl font-bold">Send Email</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="to" className="block mb-1">
            To:
          </label>
          <input
            type="email"
            id="to"
            name="to"
            value={to}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 text-gray-200 bg-gray-800 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="subject" className="block mb-1">
            Subject:
          </label>
          <input
            type="text"
            id="subject"
            name="subject"
            value={subject}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 text-gray-200 bg-gray-800 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="text" className="block mb-1">
            Message:
          </label>
          <textarea
            id="text"
            name="text"
            value={text}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 text-gray-200 bg-gray-800 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          className={classnames('bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded', {
            'opacity-50 cursor-not-allowed': isSending,
          })}
          disabled={isSending}
        >
          {isSending ? 'Sending...' : 'Send Email'}
        </button>
        {isSent && <p className="mt-2 text-green-500">Email sent successfully!</p>}
        {error && <p className="mt-2 text-red-500">{error}</p>}
      </form>
    </div>
  );
};

export default EmailForm;
