import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  await setDoc(doc(db, 'settings', 'maintenance'), { enabled: false }, { merge: true });
  console.log('Maintenance disabled');
  process.exit(0);
}
run();
