const API_KEY = 'AIzaSyCM-G8Prk3epmTwDAT5SxNsFHDg9Q6COKU';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

async function listModels() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(error);
    }
}

listModels();
