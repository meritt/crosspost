/**
 * @fileoverview Tests for the LinkedInStrategy class.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import assert from "node:assert";
import { LinkedInStrategy } from "../../src/strategies/linkedin.js";
import { MockServer, FetchMocker } from "mentoss";

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------

const ACCESS_TOKEN = "test-token-123";
const POST_URL = "/rest/posts";
const LINKEDIN_VERSION = "202604";
const POST_ID = "urn:li:share:123456789";

const CREATE_POST_RESPONSE = {
	id: POST_ID,
};

const USER_INFO_URL = "/v2/userinfo";
const USER_INFO_RESPONSE = {
	sub: "123456789",
	name: "Test User",
	given_name: "Test",
	family_name: "User",
	picture: "https://example.com/photo.jpg",
	locale: {
		country: "US",
		language: "en",
	},
};

const server = new MockServer("https://api.linkedin.com");
const fetchMocker = new FetchMocker({
	servers: [server],
});

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("LinkedInStrategy", () => {
	describe("constructor", () => {
		it("should throw a TypeError if access token is missing", () => {
			assert.throws(
				() => {
					new LinkedInStrategy({});
				},
				TypeError,
				"Missing access token.",
			);
		});

		it("should create an instance with correct id and name", () => {
			const strategy = new LinkedInStrategy({
				accessToken: ACCESS_TOKEN,
			});
			assert.strictEqual(strategy.id, "linkedin");
			assert.strictEqual(strategy.name, "LinkedIn");
		});
	});

	describe("post", () => {
		const options = { accessToken: ACCESS_TOKEN };
		const UPLOAD_INIT_URL = "/rest/images?action=initializeUpload";
		const UPLOAD_URL = "https://example.com/upload";

		beforeEach(() => {
			fetchMocker.mockGlobal();

			// Mock user info endpoint
			server.get(
				{
					url: USER_INFO_URL,
					headers: {
						authorization: `Bearer ${ACCESS_TOKEN}`,
						"content-type": "application/json",
					},
				},
				{
					status: 200,
					body: USER_INFO_RESPONSE,
				},
			);
		});

		afterEach(() => {
			fetchMocker.unmockGlobal();
			server.clear();
		});

		it("should throw an Error if message is missing", async () => {
			const strategy = new LinkedInStrategy({
				...options,
			});
			await assert.rejects(
				async () => {
					await strategy.post();
				},
				TypeError,
				"Missing message to post.",
			);
		});

		it("should successfully post a message", async () => {
			const text = "Hello, LinkedIn world!";
			const strategy = new LinkedInStrategy({
				...options,
				accessToken: ACCESS_TOKEN,
			});

			server.post(
				{
					url: POST_URL,
					headers: {
						authorization: `Bearer ${ACCESS_TOKEN}`,
						"content-type": "application/json",
						"linkedin-version": LINKEDIN_VERSION,
						"x-restli-protocol-version": "2.0.0",
					},
					body: {
						author: `urn:li:person:${USER_INFO_RESPONSE.sub}`,
						commentary: text,
						visibility: "PUBLIC",
						distribution: {
							feedDistribution: "MAIN_FEED",
							targetEntities: [],
							thirdPartyDistributionChannels: [],
						},
						lifecycleState: "PUBLISHED",
						isReshareDisabledByAuthor: false,
					},
				},
				{
					status: 201,
					headers: { "x-restli-id": POST_ID },
					body: "",
				},
			);

			const response = await strategy.post(text);
			assert.deepStrictEqual(response, CREATE_POST_RESPONSE);
		});

		it("should successfully post a message with an image", async () => {
			const text = "Hello, LinkedIn world!";
			const imageData = new Uint8Array([1, 2, 3, 4]);
			const strategy = new LinkedInStrategy(options);

			// Mock image upload initialization endpoint
			server.post(
				{
					url: UPLOAD_INIT_URL,
					headers: {
						authorization: `Bearer ${ACCESS_TOKEN}`,
						"content-type": "application/json",
						"linkedin-version": LINKEDIN_VERSION,
						"x-restli-protocol-version": "2.0.0",
					},
					body: {
						initializeUploadRequest: {
							owner: `urn:li:person:${USER_INFO_RESPONSE.sub}`,
						},
					},
				},
				{
					status: 200,
					body: {
						value: {
							image: "urn:li:image:123456789",
							uploadUrl: UPLOAD_URL,
						},
					},
				},
			);

			// Mock image upload endpoint
			server.put(
				{
					url: UPLOAD_URL,
					headers: {
						authorization: `Bearer ${ACCESS_TOKEN}`,
						"content-type": "image/*",
					},
					body: imageData.buffer,
				},
				{
					status: 200,
				},
			);

			server.post(
				{
					url: POST_URL,
					headers: {
						authorization: `Bearer ${ACCESS_TOKEN}`,
						"content-type": "application/json",
						"linkedin-version": LINKEDIN_VERSION,
						"x-restli-protocol-version": "2.0.0",
					},
					body: {
						author: `urn:li:person:${USER_INFO_RESPONSE.sub}`,
						commentary: text,
						visibility: "PUBLIC",
						distribution: {
							feedDistribution: "MAIN_FEED",
							targetEntities: [],
							thirdPartyDistributionChannels: [],
						},
						lifecycleState: "PUBLISHED",
						isReshareDisabledByAuthor: false,
						content: {
							media: {
								id: "urn:li:image:123456789",
								altText: "Test image",
							},
						},
					},
				},
				{
					status: 201,
					headers: { "x-restli-id": POST_ID },
					body: "",
				},
			);

			const response = await strategy.post(text, {
				images: [
					{
						alt: "Test image",
						data: imageData,
					},
				],
			});

			assert.deepStrictEqual(response, CREATE_POST_RESPONSE);
		});

		it("should successfully post a message with multiple images", async () => {
			const text = "Hello, LinkedIn world!";
			const imageData1 = new Uint8Array([1, 2, 3, 4]);
			const imageData2 = new Uint8Array([5, 6, 7, 8]);
			const strategy = new LinkedInStrategy(options);

			// Mock first image upload initialization
			server.post(
				{
					url: UPLOAD_INIT_URL,
					headers: {
						authorization: `Bearer ${ACCESS_TOKEN}`,
						"content-type": "application/json",
						"linkedin-version": LINKEDIN_VERSION,
						"x-restli-protocol-version": "2.0.0",
					},
				},
				{
					status: 200,
					body: {
						value: {
							image: "urn:li:image:111111111",
							uploadUrl: UPLOAD_URL,
						},
					},
				},
			);

			server.post(
				{
					url: UPLOAD_INIT_URL,
					headers: {
						authorization: `Bearer ${ACCESS_TOKEN}`,
						"content-type": "application/json",
						"linkedin-version": LINKEDIN_VERSION,
						"x-restli-protocol-version": "2.0.0",
					},
				},
				{
					status: 200,
					body: {
						value: {
							image: "urn:li:image:222222222",
							uploadUrl: UPLOAD_URL,
						},
					},
				},
			);

			server.put(
				{
					url: UPLOAD_URL,
					headers: {
						authorization: `Bearer ${ACCESS_TOKEN}`,
						"content-type": "image/*",
					},
				},
				{
					status: 200,
				},
			);

			server.put(
				{
					url: UPLOAD_URL,
					headers: {
						authorization: `Bearer ${ACCESS_TOKEN}`,
						"content-type": "image/*",
					},
				},
				{
					status: 200,
				},
			);

			server.post(
				{
					url: POST_URL,
					headers: {
						authorization: `Bearer ${ACCESS_TOKEN}`,
						"content-type": "application/json",
						"linkedin-version": LINKEDIN_VERSION,
						"x-restli-protocol-version": "2.0.0",
					},
					body: {
						author: `urn:li:person:${USER_INFO_RESPONSE.sub}`,
						commentary: text,
						visibility: "PUBLIC",
						distribution: {
							feedDistribution: "MAIN_FEED",
							targetEntities: [],
							thirdPartyDistributionChannels: [],
						},
						lifecycleState: "PUBLISHED",
						isReshareDisabledByAuthor: false,
						content: {
							multiImage: {
								images: [
									{
										id: "urn:li:image:111111111",
										altText: "Image one",
									},
									{
										id: "urn:li:image:222222222",
										altText: "Image two",
									},
								],
							},
						},
					},
				},
				{
					status: 201,
					headers: { "x-restli-id": POST_ID },
					body: "",
				},
			);

			const response = await strategy.post(text, {
				images: [
					{ alt: "Image one", data: imageData1 },
					{ alt: "Image two", data: imageData2 },
				],
			});

			assert.deepStrictEqual(response, CREATE_POST_RESPONSE);
		});

		it("should handle post request failure", async () => {
			server.post(POST_URL, {
				status: 403,
				body: {
					message: "Forbidden",
				},
			});

			const strategy = new LinkedInStrategy(options);

			await assert.rejects(async () => {
				await strategy.post("Hello world!");
			}, /403 Failed to create post/);
		});

		it("should abort when signal is triggered", async () => {
			const text = "Hello, LinkedIn world!";
			const strategy = new LinkedInStrategy(options);
			const controller = new AbortController();

			server.get(
				{
					url: USER_INFO_URL,
					headers: {
						authorization: `Bearer ${ACCESS_TOKEN}`,
						"content-type": "application/json",
					},
				},
				{
					status: 200,
					delay: 50,
					body: USER_INFO_RESPONSE,
				},
			);

			server.post(
				{
					url: POST_URL,
					headers: {
						authorization: `Bearer ${ACCESS_TOKEN}`,
						"content-type": "application/json",
						"linkedin-version": LINKEDIN_VERSION,
						"x-restli-protocol-version": "2.0.0",
					},
					body: {
						author: `urn:li:person:${USER_INFO_RESPONSE.sub}`,
						commentary: text,
						visibility: "PUBLIC",
						distribution: {
							feedDistribution: "MAIN_FEED",
							targetEntities: [],
							thirdPartyDistributionChannels: [],
						},
						lifecycleState: "PUBLISHED",
						isReshareDisabledByAuthor: false,
					},
				},
				{
					status: 201,
					headers: { "x-restli-id": POST_ID },
					body: "",
					delay: 100,
				},
			);

			setTimeout(() => controller.abort(), 10);

			await assert.rejects(async () => {
				await strategy.post(text, { signal: controller.signal });
			}, /AbortError/);
		});
	});

	describe("getUrlFromResponse", function () {
		let strategy;
		const options = { accessToken: ACCESS_TOKEN };

		beforeEach(function () {
			strategy = new LinkedInStrategy(options);
		});

		it("should generate the correct URL from a response", function () {
			const response = {
				id: "urn:li:share:123456789",
			};

			const url = strategy.getUrlFromResponse(response);
			assert.strictEqual(
				url,
				"https://www.linkedin.com/feed/update/urn:li:share:123456789",
			);
		});

		it("should throw an error when the post ID is missing", function () {
			const response = {};

			assert.throws(() => {
				strategy.getUrlFromResponse(response);
			}, /Post ID not found in response/);
		});

		it("should throw an error when the response is null", function () {
			assert.throws(() => {
				strategy.getUrlFromResponse(null);
			}, /Post ID not found in response/);
		});
	});

	describe("MAX_MESSAGE_LENGTH", () => {
		let strategy;
		beforeEach(() => {
			strategy = new LinkedInStrategy({ accessToken: "token" });
		});
		it("should have a MAX_MESSAGE_LENGTH property", () => {
			assert.ok(
				Object.prototype.hasOwnProperty.call(
					strategy,
					"MAX_MESSAGE_LENGTH",
				),
				"MAX_MESSAGE_LENGTH property is missing",
			);
			assert.strictEqual(typeof strategy.MAX_MESSAGE_LENGTH, "number");
		});
	});

	describe("calculateMessageLength", () => {
		let strategy;
		beforeEach(() => {
			strategy = new LinkedInStrategy({ accessToken: "token" });
		});
		it("should calculate length of plain text correctly", () => {
			const msg = "Hello world!";
			assert.strictEqual(
				strategy.calculateMessageLength(msg),
				msg.length,
			);
		});
		it("should count URLs as their actual length", () => {
			const msg =
				"Check this out: https://example.com/abcde and http://foo.bar";
			assert.strictEqual(
				strategy.calculateMessageLength(msg),
				[...msg].length,
			);
		});
	});
});
