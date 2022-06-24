import express from "express";

import * as dotenv from "dotenv";

import { google } from 'googleapis';

import { Credentials } from 'google-auth-library';

import fs from 'fs';

dotenv.config();

const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/drive'];

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URL = process.env.REDIRECT_URL || '';
const PORT = process.env.PORT || 3000;
const CREDENTIALS_FILE_PATH = process.env.CREDENTIALS_FILE_PATH || '';

const COPY_PRESENTATION_ID = process.env.COPY_PRESENTATION_ID || '';
const NEW_PRESENTATION_TITLE = process.env.NEW_PRESENTATION_TITLE || '';

const app = express();

app.get("/", async function (req, res) {
    const { code } = req.query;
    const oauthClient = await getOAuthClient(code as string);

    if (oauthClient) {
        const credentials = oauthClient?.credentials || {};

        fs.writeFileSync(CREDENTIALS_FILE_PATH, JSON.stringify(credentials));

        const service = google.drive({ version: 'v2', auth: oauthClient });

        const request = {
            name: NEW_PRESENTATION_TITLE
        };

        try {

            const params = {
                fileId: COPY_PRESENTATION_ID,
                resource: request,
            };

            const driveResponse = await service.files.copy(params);

            const presentationCopyId = driveResponse.data.id;
            console.log('Created copied presentation with ID: ' + presentationCopyId);


            if (presentationCopyId) {
                const url = `https://docs.google.com/presentation/d/${presentationCopyId}/`
                res.send({ url });
                return;
            }

        } catch (err) {
            console.log(err);
        }

    }

    res.send("Error generating presentation");

});

app.listen(PORT, () => {
    console.log(`Server started. Listening on port ${PORT}`);
    setup();
});

async function setup() {
    const authUrl = await getAuthUrl();

    console.log("\n\n");
    console.log("AUTH URL:\n\n")
    console.log(authUrl);
    console.log("\n\n");
}

async function getOAuthClient(code: string) {

    const token = await getGoogleAPIToken(code);
    if (!token) return undefined;

    const oAuth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, '', '');
    oAuth2Client.setCredentials(token as Credentials);
    return oAuth2Client;
}

function getAuthUrl(): string {
    const authClient = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URL);
    return authClient.generateAuthUrl({
        access_type: 'offline',
        scope: GOOGLE_SCOPES,
    });
}

async function getGoogleAPIToken(code: string): Promise<Credentials | Error> {

    let token;

    if (fs.existsSync(CREDENTIALS_FILE_PATH)) {
        const tokenStr = fs.readFileSync(CREDENTIALS_FILE_PATH).toString();
        token = JSON.parse(tokenStr);
        if (token && token.expiry_date > new Date().getTime()) {
            return Promise.resolve(token)
        }
    }

    const authClient = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URL);

    return new Promise(async (resolve, reject) => {

        try {
            const resp = await authClient.getToken(code);
            token = resp.tokens;
            resolve(token);
        } catch (error) {
            console.log(error);
            reject(error);
        }

    });

}
