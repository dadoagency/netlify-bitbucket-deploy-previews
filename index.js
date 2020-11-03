const express = require('express');
const axios = require('axios');
const NetlifyAPI = require('netlify');
require('custom-env').env();

const PORT = process.env.PORT || 3000;
const BUILD_HOOK_URL = process.env.BUILD_HOOK_URL;
const BITBUCKET_USER = process.env.BITBUCKET_USER;
const BITBUCKET_PASS = process.env.BITBUCKET_PASS;
const NETLIFY_API_TOKEN = process.env.NETLIFY_API_TOKEN;

if (!BUILD_HOOK_URL) {
	console.error('No build hook URL provided.');
	process.exit(1);
}

if (!BITBUCKET_USER) {
	console.error('No BITBUCKET_USER provided.');
	process.exit(1);
}

if (!BITBUCKET_PASS) {
	console.error('No BITBUCKET_PASS provided');
	process.exit(1);
}

if (!NETLIFY_API_TOKEN) {
	console.error('No NETLIFY_API_TOKEN provided');
	process.exit(1);
}

const app = express();
app.use(express.json());
const netlifyClient = new NetlifyAPI(NETLIFY_API_TOKEN);

// will fire from a bitbucket webhook (create and update PR)
// this function will get the source branch from PR
// and send a post request to a netlify build hook
// which will trigger a build for the source branch
app.post('/deploy', async (req, res) => {
	try {
		//get source branch from pr
		const branch = req.body.pullrequest.source.branch.name;
		if (!branch) {
			throw new Error('Invalid branch');
		}
		// start build for target branch
		const url = `${BUILD_HOOK_URL}?trigger_branch=${branch}&trigger_title=PR-preview-for-${branch}`;
		await axios.post(url);
	} catch (e) {
		console.log('error', e);
		res.send(e.toString());
	}
});

// fires when the netlify deployment is complete
// triggered from netlify outgoing webhook notification for successful deploy
// this function should:
// 1: take the siteID from the request
// 2: fetch site details from netlify API using siteID
// 3. get the repo URL from the response of 2
// 4. use repo URL to query BB API for pull requests
// 5 if there are PRs - add comments with deploy URL
app.post('/deployed', async (req, res) => {
	try {
		// 1 get site id
		const siteId = req.body.site_id;
		// 2 get site details
		const siteDetails = await netlifyClient.getSite({ site_id: siteId });
		// 3 get repo url
		const repoUrl = siteDetails.build_settings.repo_url;
		// 4 get pull requests 
		const repoName = repoUrl.split('https://bitbucket.org/')[1];
        const bitbucketAPIBaseURL = `https://api.bitbucket.org/2.0/repositories/${repoName}`;
        const bitbucketClient = axios.create({
            baseURL: bitbucketAPIBaseURL,
            auth: {
                username: BITBUCKET_USER,
                password: BITBUCKET_PASS
            }
        })

        const pullRequests = await bitbucketClient.get(`/pullrequests?q=source.branch.name="${req.body.branch}"`)

        // 5 - add comment with deploy url for each pr
        if (pullRequests.data.size > 0) {
            const commentRequests = pullRequests.data.values.map(({id}) => {
                return bitbucketClient.post(`/pullrequests/${id}/comments`, { body: { content: `preview URL ${req.body.deploy_ssl_url}`}})
            });

            const results = await Promise.all(commentRequests)
            return res.send(results);
        }

        return res.send({message: `No PRs found for branch ${req.body.branch}`});
	} catch (e) {
		console.log(e);
		return res.send(e.toString());
	}
});

app.listen(PORT, () => console.log('listening on ', PORT));
