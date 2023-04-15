import { useState } from 'react'
import { useEffect } from 'react'
import reactLogo from './assets/react.svg'
import './App.css'
import Api from 'youtube-browser-api'
import assert from "node:assert"
import { get_encoding, encoding_for_model } from "@dqbd/tiktoken"
import 'typeface-poppins'
import { GoAlert, GoIssueOpened, GoInfo } from "react-icons/go"

function App() {
  const [invalidURL, setInvalidURL] = useState(false) //If the URL is invalid, this is set to true. For input validation
  const [invalidKey, setInvalidKey] = useState(false) //If the api key is invalid, this is set to true. For input validation
  const [status, setStatus] = useState("")
  const [errorType, setErrorType] = useState("")
  const enc = encoding_for_model("gpt-3.5-turbo") //Encoder model for string tokenization

  const summaryList = document.querySelector("#summaryList")
  const startButton = document.querySelector("#startButton")
  const errorIndicator = document.querySelector("#error")
  const errorText = document.querySelector("#errorText")

  const API_KEY = "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"
  const systemMessage = {
    role : "system",
    content : "You are a program that analyzes long form text and summarizes it effectively and concisely in a few sentences. Include all main points and as many details as possible."
  }

async function start() {
  let urlInput = document.getElementById("urlInput")
  let apiKeyInput = document.getElementById("apikeyinput")

  let url = urlInput.value
  let apikey = apiKeyInput.value

  let validKey = (apikey.length == 51 && apikey.substring(0,3) == "sk-") //Checks if the API key is valid
  let validURL = (url.length == 43 && url.substring(0,32) == "https://www.youtube.com/watch?v=") //Full-length YouTube URL
  || (url.length == 28 && url.substring(0,17) == "https://youtu.be/") //Shortened YouTube URL

  if (validKey && validURL) {
    setInvalidURL(false)
    setInvalidKey(false)
    setStatus("RUNNING")
    setErrorType("") //Reset error type
    callYTAPI(url, apikey)
    getTitleAndThumbnail(url)
    setErrorType("")
    
  }
  else {
    setInvalidKey(!validKey)
    setInvalidURL(!validURL)
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

  async function getTitleAndThumbnail(url) { 
  let thumbnail = document.querySelector("#thumbnail")
  let thumbnailLink = document.querySelector("#thumbnaillink")
  let videoTitle = document.querySelector("#title")
  let videoChannel = document.querySelector("#channel")

    var API_KEY = "AIzaSyA_KOQlLawDfQM-UzBA0qX1aYnidsbSmh0"
    let VIDEO_ID = getID(url)

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

async function callYTAPI(url, apikey) { 
  console.log("Fetching Transcript...")
  
  const query = {
    videoId: getID(url) 
}

const fetchUrl = "https://youtube-browser-api.netlify.app/transcript?" + new URLSearchParams(query).toString()
fetch(fetchUrl)
.then(res => {
  if (res.status === 500) {
    return Promise.reject(new Error("Response status code is 500"));
  }
  else {
  return res.json();
  }
})
    .then (
      res => callOpenAIAPI(res, apikey)
    ).catch((error) => {
      if (error.message === "Response status code is 500") {
        setStatus("ERROR")
        setErrorType("NOT_FOUND")
      } else {
        setStatus("ERROR")
        setErrorType("INVALID_KEY")
        setInvalidKey(true)
      }
    }
    );
  
}

async function callOpenAIAPI(transcript, apikey) { //Calls the OpenAI API to generate the summary

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
          "Authorization": "Bearer " + apikey
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
        "Authorization": "Bearer " + apikey
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

//setRunning(false); //After summary is processed, sets running to false which hides the loading animation and shows the summary
setStatus("SUCCESS")

}

function showInfoPopup() {

  let apiPopup = document.getElementById("apikeypopup")
  let infoIcon = document.getElementById("infoicon")

  apiPopup.classList.toggle("hidden")
  infoIcon.classList.toggle("outline-dotted")
  infoIcon.classList.toggle("outline-white")
  infoIcon.classList.toggle("outline-2")
}

  return (
    <div className="App" class="font-sans">
    <div class="w-full h- bg-white"> </div>
      <h1 class="mb-4 font-extrabold text-5xl">Turbo<span class="bg-clip-text text-transparent bg-gradient-to-bl from-blue-500 via-blue-400 to-green-300">Transcript</span></h1>
      <h3 class="font-inter text-xl">

        Use the power of OpenAI's <a href="https://platform.openai.com/docs/models/gpt-3-5" class="font-mono hover:font-semibold hover:text-blue-400 underline" target="_blank">gpt-3.5-turbo</a> model to
        <br></br>summarize a YouTube video in only <em class="font-bold">ONE CLICK!</em>

      </h3>
      <div>

        <div id="tooltip">
          <span id="tooltipText">

           Must be a valid YouTube URL, e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ

          </span>
        
        <div class="flex items-center justify-center" style={{ height: '20px' }}>
          <input id="urlInput" class={`font-mono rounded-md pl-2 text-sm bg-slate-800 ${invalidURL ? 'border-2 border-red-500' : 'border-0'}`}
        placeholder="Paste YouTube URL" //Make it so URL is updated only when start is clicked and not constantly
        size="52"
        maxLength="43"
      />

        {invalidURL && ( //Shows the invalid URL icon next to the text box when invalidURL is true
        <GoIssueOpened
          className="text-red-500 ml-2"
          size={20}
        />
        )}

        
        </div>
        </div>

        <div class="relative flex items-center justify-center mt-5 mb-2" style={{ height: '20px' }}>
  <GoInfo id="infoicon" class="mr-2 mb-2 cursor-pointer" size={20} onClick={e => (showInfoPopup())}/>
  <input placeholder="Paste API Key"
     class={`font-mono rounded-md pl-2 bg-slate-800 border-0 text-sm mb-2 ${invalidKey ? 'border-2 border-red-500' : 'border-0'}`}
     id="apikeyinput"
     type="password"
     size="50"
     maxLength="51"
  />
  {invalidKey && (
  <GoIssueOpened
    className="text-red-500 ml-2 mb-2"
    size={20}
  />
  )}

  <div id="apikeypopup" class="hidden absolute bg-slate-700 pb-4 pt-2 pr-9 rounded-lg opacity-100 transition-opacity duration-300 z-50"
     style={{ top: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)', width: '500px'}}>
    <h4 class="text-lg font-bold">What is this?</h4>
    <p class="text-xs text-left ml-10">
      <span class="text-center text-sm">
      Using the OpenAI API requires an API Key. Getting one is easy!
      </span>
      <br/>
      
      1. Create an OpenAI account <br/>
      2. Visit this url: <a href="https://platform.openai.com/account/api-keys" class="font-mono hover:font-semibold hover:text-blue-400 underline" target="_blank">https://beta.openai.com/account/api-keys</a><br/>
      3. Click "Create new secret key"<br/>
      4. Paste it in the box above. Don't worry, this will not be stored anywhere<br/>
      5. Enjoy!
    </p>
  </div>
</div>

        </div>
        <div>

        <button class={`bg-slate-800 ${status == "RUNNING" ? "pointer-events-none opacity-75" : ""}`} id="startButton" onClick={start}>
          <span class="font-bold">Generate Summary</span>
        </button> 

        {status == "RUNNING" && //Shows the loading indicator when the api requests are loading, and hides once results are ready to display
        <div id="loadingIndicator" class="mt-10 flex flex-col items-center justify-center h-full">
        <div class="loader mx-auto"></div>
        <h5 class="mt-4">Generating Summary...</h5>
      </div>
      }

        {status == "ERROR" && (
        <div id="error" class="mt-5 flex flex-col items-center">
          <GoAlert size={56} class="mb-3"></GoAlert>
        <h4 class="font-bold mb-2">Summary could not be generated</h4>
        <h6 id="errorText" class="text-xs">
          {errorType == "NOT_FOUND" ? "Video does not exist or does not have a transcript. Please try another video" : 
          errorType == "INVALID_KEY" ? "Invalid API Key. Please check your API Key and try again" :
          "An OpenAI-related error occured. May be rate limited or the API is down"}</h6>
        </div>
        )
        }
        
        

        <div id="summaryList" class={`${status == "SUCCESS" ? "" : "hidden"}`}>
        <a href ="" id="thumbnaillink" target="_blank" class="flex align-middle justify-center mt-10">
        <img id="thumbnail" src="" class="border-2 mt-2 mb-2"></img>
        </a>
        <h4 id="title" class="font-bold"></h4>
        <h5 id="channel"></h5>
        <ul id="ul"></ul>
        <p class="text-xs mt-8">Due to the nature of AI, the summary will be unique every time. Not satisfied with this response? Click the generate button again!
        </p>
        </div>

        
      </div>
    </div>
  )
}

export default App
