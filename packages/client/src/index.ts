import PouchDB from "pouchdb";

const db = new PouchDB("test");

document.getElementById("test").innerHTML = "";