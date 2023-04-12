import { useState } from 'react'
import { useEffect } from 'react'
import reactLogo from './assets/react.svg'
import './App.css'
import Api from 'youtube-browser-api'
import assert from "node:assert"
import { get_encoding, encoding_for_model } from "@dqbd/tiktoken"
import 'typeface-poppins'
import { GoAlert, GoIssueOpened } from "react-icons/go"

function App() {

  const [url, setUrl] = useState("") //The URL of the video
  const [invalidURL, setInvalidURL] = useState(false) //If the URL is invalid, this is set to true. For input validation
  const [running, setRunning] = useState(false) //If the summary is being generated, this is set to true. For loading animation
  const [notFound, setNotFound] = useState(false) //If the video is not found, this is set to true. For error handling
  const enc = encoding_for_model("gpt-3.5-turbo") //Encoder model for string tokenization

  var summaryList = document.querySelector("#summaryList")
  var thumbnail = document.querySelector("#thumbnail")
  var thumbnailLink = document.querySelector("#thumbnaillink")
  var videoTitle = document.querySelector("#title")
  var videoChannel = document.querySelector("#channel")
  var startButton = document.querySelector("#startButton")
  var errorIndicator = document.querySelector("#error")
  var errorText = document.querySelector("#errorText")

  const API_KEY = "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"
  const systemMessage = {
    role : "system",
    content : "You are a program that analyzes long form text and summarizes it effectively and concisely in a few sentences. Include all main points and any necessary supplementary details."
  }

async function start() {
  if ((url.length == 43 && url.substring(0,32) == "https://www.youtube.com/watch?v=") //Full-length YouTube URL
  || (url.length == 28 && url.substring(0,17) == "https://youtu.be/") //Shortened YouTube URL
  ) {
    setInvalidURL(false)
    startButton.disabled = true;
    errorText.innerHTML = ""
    callYTAPI()
    getTitleAndThumbnail()
    setRunning(true)
    setNotFound(false)
    summaryList.setAttribute("hidden","hidden"); //Hides the summarylist while generating the next summary
    if (errorIndicator) {
      errorIndicator.setAttribute("hidden","hidden"); //Hides the error indicator, if it is visible
    }
    
  }
  else {
    console.error("Invalid URL Inputted")
    setInvalidURL(true)
  }
}

function getID(url) { //Gets the ID of the video from the URL, for passing into API calls
  let idIndex = ""
  if (url.includes("?v=")) { //This means it is a full length YouTube URL
    idIndex = url.indexOf("?v=")
  }
  else { //This means it is a shortened YouTube URL
    idIndex = url.indexOf("be/")
  }
  return url.substring(idIndex + 3)
}

  async function getTitleAndThumbnail() {
    var API_KEY = "AIzaSyA_KOQlLawDfQM-UzBA0qX1aYnidsbSmh0"
    var VIDEO_ID = getID(url)

    fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${VIDEO_ID}&key=${API_KEY}`)
  .then(response => response.json())
  .then(data => {
    const videoData = data.items[0].snippet
    videoTitle.innerHTML = videoData.title
    videoChannel.innerHTML = videoData.channelTitle
    thumbnail.src = videoData.thumbnails.medium.url
    thumbnailLink.href = url
  })
  .catch(error => console.error(error))
  }

async function callYTAPI() { 
  console.log("Fetching Transcript...")
  
  const query = {
    videoId: getID(url) 
}

const fetchUrl = "https://youtube-browser-api.netlify.app/transcript?" + new URLSearchParams(query).toString()
fetch(fetchUrl)
    .then(
      res => res.json()
      )
    .then (
      res => callOpenAIAPI(res)
    ).catch((error) => {
      setNotFound(true);
      errorText.innerHTML = "Error: Video doesn't exist or doesn't have an available transcript.";
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

  if (tokenizedString.length > 2500) {

    console.log("Video too long, splitting into multiple requests")

    let requests = []
    let currentResponse = ""

    for (let i = 0; i < tokenizedString.length; i += 2500) {
      let subArray = tokenizedString.slice(i, i + 2500)
      requests.push(new TextDecoder().decode(enc.decode(subArray)))
    }

    for (let request of requests) {

      console.log("Performing OpenAI call")

      let additionalMessage = "" //Let the AI know that this is a continuation of the previous request
      if (currentResponse != "") {
        additionalMessage = "Also include this information: " + currentResponse
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

      const data = await response.json()
      currentResponse = data.choices[0].message.content.replace(/- /g, "");
    }

    const summary = currentResponse;
    processSummary(summary)

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

    const data = await response.json()
    const summary = data.choices[0].message.content.replace(/- /g, "");
    processSummary(summary);

  }
}

async function processSummary(unprocessedSummary) {
  console.log("Processing summary...")
  let fullText = unprocessedSummary
  var splitText = fullText.split('. '); //Somehow make it so that it makes a new line at the end of every sentence, and not just every period.

  summaryList.removeAttribute("hidden")

  let ul = document.querySelector('#ul')

  if (ul) {
  while(ul.firstChild) ul.removeChild(ul.firstChild)
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
      <h1 class="mb-4 font-extrabold text-5xl">Turbo<span class="bg-clip-text text-transparent bg-gradient-to-bl from-blue-500 via-blue-400 to-green-300">Transcript</span></h1>
      <h3 class="font-inter text-xl">

        Use the power of OpenAI's <a href="https://platform.openai.com/docs/models/gpt-3-5" class="font-mono hover:font-semibold hover:text-gray-400 underline" target="_blank">gpt-3.5-turbo</a> model to
        <br></br>summarize a YouTube video in only <em class="font-bold">ONE CLICK!</em>

      </h3>
      <div>

        <div id="tooltip">
          <span id="tooltipText">

           Must be a valid YouTube URL, e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ

          </span>

        <div class="flex items-center justify-center">
          <textarea class={`font-mono rounded-md pl-2 bg-slate-800 ${invalidURL ? 'border-2 border-red-500' : 'border-0'}`}
        onChange={(e) => {
          setUrl(e.target.value);
        }}
        placeholder="Paste YouTube URL"
        cols={50}
        rows={1}
        maxLength={43}
      />

        {invalidURL && ( //Shows the invalid URL icon next to the text box when invalidURL is true
        <GoIssueOpened
          className="text-red-500 ml-2 mb-2"
          size={20}
        />
        )}
        </div>
        </div>
      </div>
      <div>

        <button class="bg-slate-800" id="startButton" onClick={start}>
          <span class="font-bold">Generate Summary</span>
        </button> 

        {running && !notFound ? //Shows the loading indicator when the api requests are loading, and hides once results are ready to display
        <div id="loadingIndicator" class="mt-5">
        <div class="loader">
        </div>
        <h5>Generating Summary...</h5>
        </div>
        :
        null
      }

        {notFound ?
        <div id="error" class="mt-5 flex flex-col items-center">
          <GoAlert size={56} class="mb-3"></GoAlert>
        <h4 class="font-bold mb-2">Summary could not be generated</h4>
        </div>
        :
        null
        }
        
        <h6 id="errorText" class="text-xs"></h6>
        

        <div id="summaryList" hidden>
        <hr></hr>
        <a href ="" id="thumbnaillink" target="_blank" class="flex align-middle justify-center">
        <img id="thumbnail" src="" class="border-2 mt-2 mb-2"></img>
        </a>
        <h4 id="title"></h4>
        <h5 id="channel"></h5>
        <hr></hr>
        <ul id="ul"></ul>
        <p class="text-xs mt-8">Due to the nature of AI, the summary will be unique every time. Not satisfied with this response? Click the generate button again!
        </p>
        </div>

        
      </div>
    </div>
  )
}

export default App
