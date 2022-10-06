/* this example illustrates connecting to firebase and making API calls with Alexa
see my alexa firebase quickstart doc here:
https://docs.google.com/document/d/1y7NBJFizE_v4gkjDhdYllkbKvcCEHDlrRIy2B3gl8PE
- Evan
*/

const Alexa = require('ask-sdk-core');
const { initializeApp } = require('firebase/app')
const { getFirestore, doc, setDoc, getDoc } = require('firebase/firestore');

const firebaseConfig = 'FILL IN';

// initialize firebase app + firestore database
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// called when the skill is invoked
const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    // important to make sure that this function is async because we have async/await calls
    async handle(handlerInput) {
        // get the Alexa user ID associated request
        var userId = Alexa.getUserId(handlerInput.requestEnvelope);
        const userIdSplit = userId.split(".");
        userId = userIdSplit[3];

        // reference to that user's document in the "users" collection
        const docRef = doc(db, "users", userId);
        const docSnap = await getDoc(docRef);

        // initialize default values of count + length
        var count = 0;
        var length = 0;

        // if the user has already used this app, we will already have a document for them in firebase
        if (docSnap.exists()) {
            const returnedData = docSnap.data();
            // count is the number of times the user has asked for the weather
            count = parseInt(returnedData['count']);
            length = parseInt(returnedData['length']);

            // update the count
            // note that I am doing this in the launch handler because this skill is simple and returns
            // the weather on launch. if your skill has an invocation for the weather separate from
            // the launch handler, you could update the count there
            count = count + 1;
            await setDoc(docRef, {
                count: count,
            }, { merge: true });
        } else {
            // doc.data() would be undefined in this case since no user exists
            // so we need to make a new user document for this user id
            length = 3; // default length of 3, to be used in calculations below
            await setDoc(docRef, {
                count: 1,
                length: 3
            });
        }

        // some parameters for the API call
        const apiKey = 'FILL IN';
        const city = 'new york';
        const url = `http://api.openweathermap.org/data/2.5/weather?q=${city}&units=imperial&appid=${apiKey}`;
        
        // make the API call and wait for the response/data
        // note: a smarter implementation here would check the response and if it is not 200 OK
        // indicate to the user that an error has happened with the API call
        const result = await getData(url);
        const neatResult = JSON.parse(result);

        // parse response. some more optional parameters commented out below
        const weather = neatResult.weather;
        const weatherDescription = weather[0].description;
        const mainInfo = neatResult.main;
        const temperature = mainInfo.temp;
        const minimum = mainInfo.temp_min;
        const maximum = mainInfo.temp_max;
        // let feelsLike = mainInfo.feels_like
        // let humidity = mainInfo.humidity;

        // change speak output based on the length value associated with the user
        var speakOutput = '';

        switch (length) {
            case 3:
                speakOutput = `Currently in New York it's ${temperature} degrees fahrenheit with ${weatherDescription}. Today you can expect a high of ${maximum} and a low of ${minimum}.`;
                break;
            case 2:
                speakOutput = `It is ${temperature} fahrenheit with ${weatherDescription}. High is ${maximum} and low is ${minimum}.`;
                break;
            case 1:
                speakOutput = `It's ${temperature} and you can expect ${weatherDescription}.`;
        }

        // every other time (except the first), so long as the length > 1, 
        // subtract one from the length and update the user's document
        if (count > 1 && count % 2 == 0 && length > 1) {
            const docRef = doc(db, "users", userId);
            const updatedLength = parseInt(length) - 1;
            await setDoc(docRef, {
                length: updatedLength,
            }, { merge: true });
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const HelloWorldIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'HelloWorldIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Hello World!';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'You can say hello to me! How can I help?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Goodbye!';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
/* *
 * FallbackIntent triggers when a customer says something that doesn’t map to any intents in your skill
 * It must also be defined in the language model (if the locale supports it)
 * This handler can be safely added but will be ingnored in locales that do not support it yet 
 * */
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Sorry, I don\'t know about that. Please try again.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
/* *
 * SessionEndedRequest notifies that a session was ended. This handler will be triggered when a currently open 
 * session is closed for one of the following reasons: 1) The user says "exit" or "quit". 2) The user does not 
 * respond or says something that does not match an intent defined in your voice model. 3) An error occurs 
 * */
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`);
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse(); // notice we send an empty response
    }
};
/* *
 * The intent reflector is used for interaction model testing and debugging.
 * It will simply repeat the intent the user said. You can create custom handlers for your intents 
 * by defining them above, then also adding them to the request handler chain below 
 * */
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};
/**
 * Generic error handling to capture any syntax or routing errors. If you receive an error
 * stating the request handler chain is not found, you have not implemented a handler for
 * the intent being invoked or included it in the skill builder below 
 * */
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        const speakOutput = 'Sorry, I had trouble doing what you asked. Please try again.';
        console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

/**
 * This handler acts as the entry point for your skill, routing all request and response
 * payloads to the handlers above. Make sure any new handlers or interceptors you've
 * defined are included below. The order matters - they're processed top to bottom 
 * */
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        HelloWorldIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler)
    .addErrorHandlers(
        ErrorHandler)
    .withCustomUserAgent('sample/hello-world/v1.2')
    .lambda();


// credit to: https://gist.github.com/germanviscuso/ba0c8e5af0491a6cb88c39bd7cd5c0c7
const getData = function (url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? require('https') : require('http');
        const request = client.get(url, (response) => {
            if (response.statusCode < 200 || response.statusCode > 299) {
                reject(new Error('Failed with status code: ' + response.statusCode));
            }
            const body = [];
            response.on('data', (chunk) => body.push(chunk));
            response.on('end', () => resolve(body.join('')));
        });
        request.on('error', (err) => reject(err))
    })
};