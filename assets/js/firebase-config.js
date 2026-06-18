import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAd_csKRHD2dEzyszjzCC3bTJvpHH_YUf8",
  authDomain: "confirmae-e629a.firebaseapp.com",
  projectId: "confirmae-e629a",
  storageBucket: "confirmae-e629a.firebasestorage.app",
  messagingSenderId: "372030861002",
  appId: "1:372030861002:web:d688248aef7a5297b8ce33"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export {
  app,
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  query,
  orderBy
};
