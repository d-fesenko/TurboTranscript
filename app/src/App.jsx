import { useState } from 'react'
import { useEffect } from 'react'
import reactLogo from './assets/react.svg'
import './App.css'
import Api from 'youtube-browser-api'
import assert from "node:assert";
import { get_encoding, encoding_for_model } from "@dqbd/tiktoken";
import 'typeface-poppins';

function App() {

  const [url, setUrl] = useState("") //The URL of the video
  const [running, setRunning] = useState(false) //If the summary is being generated, this is set to true. For loading animation
  const [notFound, setNotFound] = useState(false) //If the video is not found, this is set to true. For error handling
  const enc = encoding_for_model("gpt-3.5-turbo"); //Encoder model for string tokenization

  var summaryList = document.querySelector("#summaryList");
  var videoTitle = document.querySelector("#title");
  var videoChannel = document.querySelector("#channel");
  var startButton = document.querySelector("#startButton");
  var errorIndicator = document.querySelector("#error")
  var errorText = document.querySelector("#errorText");

  const API_KEY = "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"
  const systemMessage = {
    role : "system",
    content : "You are a program that analyzes long form text and summarizes it effectively and concisely in a few sentences. Include all main points and any necessary supplementary details."
  }

async function start() {
  if (url.length == 42 && url.substring(0,32) == "https://www.youtube.com/watch?v=" || true) { //remove the or true
    startButton.disabled = true;
    errorText.innerHTML = "";
    callYTAPI();
    getTitle();
    setRunning(true);
    setNotFound(false);
    summaryList.setAttribute("hidden","hidden"); //Hides the summarylist while generating the next summary
    if (errorIndicator) {
      errorIndicator.setAttribute("hidden","hidden"); //Hides the error indicator, if it is visible
    }
    
  }
  else {
    console.log("it aint valid cuh")
  }
}

async function isValidURL() {
  return(url.length == 42 && url.substring(0,32) == "https://www.youtube.com/watch?v=")
}

async function getTitle() {

  var idIndex = url.indexOf("?v=");

  const query = {
    id: url.substring(idIndex + 3),
    params: ["title","channel"]
};

  const fetchUrl = `https://youtube-browser-api.netlify.app/content?id=${query.id}&params=` + query.params.join()
  fetch(fetchUrl)
    .then(res => res.json())
    .then(data => {
      videoTitle.innerHTML = data.title;
      videoChannel.innerHTML = data.channel;
    });
  }

async function callYTAPI() { 
  console.log("Calling YouTubeBrowser API...")
  var idIndex = url.indexOf("?v=");

  const query = {
    videoId: url.substring(idIndex + 3) 
};
const fetchUrl = "https://youtube-browser-api.netlify.app/transcript?" + new URLSearchParams(query).toString()
fetch(fetchUrl)
    .then(
      res => res.json()
      )
    .then (
      res => callOpenAIAPI(res)
    ).catch((error) => {
      setNotFound(true);
      errorText.innerHTML = "Error: Video doesn't exist or doesn't have an available transcript. Try another video please";
      startButton.disabled = false;
    });
  
}

async function callOpenAIAPI(transcript) {

  var transcriptString = ""

  transcript.videoId.forEach(item => {
    transcriptString += item['text'] + " "
  })

  console.log("Calling the OpenAI API...")

  let tokenizedString = enc.encode(transcriptString);

  if (tokenizedString.length > 3000) {

    let requests = []
    let currentResponse = ""

    for (let i = 0; i < tokenizedString.length; i += 3000) {
      let subArray = tokenizedString.slice(i, i + 3000);
      requests.push(new TextDecoder().decode(enc.decode(subArray)));
    }

    for (let request of requests) {

      let additionalMessage = "" //Let the AI know that this is a continuation of the previous request
      if (currentResponse != "") {
        additionalMessage = currentResponse
      }

      const newMessage = {
        "role": "user",
        "content": "Summarize the following video: " + request + additionalMessage
      }

      const apiRequestBody = {
        "model" : "gpt-3.5-turbo",
        "messages" : [systemMessage,newMessage]
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + API_KEY
        },
        body: JSON.stringify(apiRequestBody)
      });

      const data = await response.json();
      currentResponse = data.choices[0].message.content.replace(/- /g, "");
    }

    const summary = currentResponse;
    processSummary(summary);

  } else {

    const newMessage = {
      "role": "user",
      "content": "Summarize the following video: " + transcriptString
    }
    const apiRequestBody = {
      "model" : "gpt-3.5-turbo",
      "messages" : [systemMessage,newMessage]
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + API_KEY
      },
      body: JSON.stringify(apiRequestBody)
    });

    const data = await response.json();
    const summary = data.choices[0].message.content.replace(/- /g, "");
    processSummary(summary);

  }
}

async function processSummary(unprocessedSummary) {
  console.log("ProcessSummary Called")
  let fullText = unprocessedSummary
  var splitText = fullText.split('. '); //Somehow make it so that it makes a new line at the end of every sentence, and not just every period.

  summaryList.removeAttribute("hidden");

  let ul = document.querySelector('#ul')

  if (ul) {
  while(ul.firstChild) ul.removeChild(ul.firstChild);
  }

  splitText.forEach(liText => {

    if (liText.slice(-1) != ".") { //If the sentence does not already end in a period, add one.
      liText += "."
    }
    
    let li = document.createElement('li')
    li.innerHTML = liText
    if(li && ul) {
      ul.appendChild(li)
    }
})

setRunning(false); //After summary is processed, sets running to false which hides the loading animation and shows the summary
startButton.disabled = false; //Reenables the button

}

  return (
    <div className="App" class="font-sans">
    <div class="w-full h- bg-white"> </div>
      <h1 class="mb-4 font-extrabold text-5xl">Turbo<span class="bg-clip-text text-transparent bg-gradient-to-bl from-green-300 via-blue-400 to-blue-500">Transcript</span></h1>
      <h3 class="font-inter text-xl">

        Use the power of OpenAI's <a href="https://platform.openai.com/docs/models/gpt-3-5" class="font-mono hover:font-semibold hover:text-gray-400 underline" target="_blank">gpt-3.5-turbo</a> model to
        <br></br>summarize a YouTube video in only <em class="font-bold">ONE CLICK!</em>

      </h3>
      <div>

        <div id="tooltip">
          <span id="tooltipText">

           Must be a valid YouTube URL, e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ

          </span>

        <textarea class="font-mono rounded-md pl-2 bg-slate-800"
        onChange={(e) => {
          setUrl(e.target.value);
        }}
        placeholder="Paste YouTube URL"
        cols={50}
        rows={1}
        maxLength={43}
      />
        </div>
      </div>
      <div>

        <button class="bg-slate-800" id="startButton" onClick={start}>
          <span class="font-bold">Generate Summary</span>
        </button> 

        {running && !notFound ? //Shows the loading indicator when the api requests are loading, and hides once results are ready to display
        <div id="loadingIndicator">
        <div class="loader">
        </div>
        <h5>Generating Summary...</h5>
        </div>
        :
        null
      }

        {notFound ?
        <div id="error">
        <h4>Summary could not be generated</h4>
        </div>
        :
        null
        }
        
        <h6 id="errorText"></h6>
        

        <div id="summaryList" hidden>
        <hr></hr>
        <h4 id="title"></h4>
        <h5 id="channel"></h5>
        <hr></hr>
        <ul id="ul"></ul>
        </div>

        
      </div>
    </div>
  )
}

export default App
