const chalk = require('chalk');
const fs = require('fs');
const luxon = require('luxon');
const path = require('path');
const requestPromiseNative = require('request-promise-native');

const shared = require('./shared');
const settings = require('./settings');

async function writeFilesPromise(posts, categories, authors, config) {
	await writeAuthorFilesPromise(authors, config);
	await writeCategoryFilesPromise(categories, config);
	await writeMarkdownFilesPromise(posts, config);
	if(config.saveImages) {
		await writeImageFilesPromise(posts, config);
	}
}

async function processPayloadsPromise(payloads, loadFunc) {
	const promises = payloads.map(payload => new Promise((resolve, reject) => {
		setTimeout(async () => {
			try {
				const data = await loadFunc(payload.item);
				await writeFile(payload.destinationPath, data);
				console.log(chalk.green('[OK]') + ' ' + payload.name);
				resolve();
			} catch (ex) {
				console.log(chalk.red('[FAILED]') + ' ' + payload.name + ' ' + chalk.red('(' + ex.toString() + ')'));
				reject();
			}
		}, payload.delay);
	}));

	const results = await Promise.allSettled(promises);
	const failedCount = results.filter(result => result.status === 'rejected').length;
	if (failedCount === 0) {
		console.log('Done, got them all!');
	} else {
		console.log('Done, but with ' + chalk.red(failedCount + ' failed') + '.');
	}
}

async function writeFile(destinationPath, data) {
	await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
	await fs.promises.writeFile(destinationPath, data);
}

async function writeMarkdownFilesPromise(posts, config ) {
	// package up posts into payloads
	let skipCount = 0;
	let delay = 0;
	const payloads = posts.flatMap(post => {
		const destinationPath = getPostPath(post, config);
		if (checkFile(destinationPath)) {
			// already exists, don't need to save again
			skipCount++;
			return [];
		} else {
			const payload = {
				item: post,
				name: (config.includeOtherTypes ? post.meta.type + ' - ' : '') + post.meta.slug,
				destinationPath,
				delay
			};
			delay += settings.markdown_file_write_delay;
			return [payload];
		}
	});

	const remainingCount = payloads.length;
	if (remainingCount + skipCount === 0) {
		console.log('\nNo posts to save...');
	} else {
		console.log(`\nSaving ${remainingCount} posts (${skipCount} already exist)...`);
		await processPayloadsPromise(payloads, loadMarkdownFilePromise);
	}
}

async function loadMarkdownFilePromise(post) {
	let output = '---\n';

	Object.entries(post.frontmatter).forEach(([key, value]) => {
		let outputValue;
		if (Array.isArray(value)) {
			if (value.length > 0) {
				// array of one or more strings
				outputValue = value.reduce((list, item) => `${list}\n  - ${item}`, '');
			}
		} else {
			// console.log(key);
			let shouldEscape = ['title'].includes(key);

			if(shouldEscape) {
				// single string value
				const escapedValue = (value || '').replace(/"/g, '\\"');
				if (escapedValue.length > 0) {
					outputValue = `"${escapedValue}"`;
				}				
			} else
			{
				// single string value
				value = (value || '');
				if (value.length > 0) {
					outputValue = `${value}`;
				}
			}

		}

		if (outputValue !== undefined) {
			output += `${key}: ${outputValue}\n`;
		}
	});

	output += `---\n\n${post.content}\n`;


	return await replace_image_prefix(output);
}

async function replace_image_prefix(output) {
	return output
		.replaceAll("https://etheriamagazine.com/wp-content/uploads/", "etheria-images/")
		.replaceAll("http://etheriamagazine.com/wp-content/uploads/", "etheria-images/")
}

async function writeImageFilesPromise(posts, config) {
	// collect image data from all posts into a single flattened array of payloads
	let skipCount = 0;
	let delay = 0;
	const payloads = posts.flatMap(post => {
		const postPath = getPostPath(post, config);
		const imagesDir = path.join(path.dirname(postPath), 'images');
		return post.meta.imageUrls.flatMap(imageUrl => {
			const filename = shared.getFilenameFromUrl(imageUrl);
			const destinationPath = path.join(imagesDir, filename);
			if (checkFile(destinationPath)) {
				// already exists, don't need to save again
				skipCount++;
				return [];
			} else {
				const payload = {
					item: imageUrl,
					name: filename,
					destinationPath,
					delay
				};
				delay += settings.image_file_request_delay;
				return [payload];
			}
		});
	});

	const remainingCount = payloads.length;
	if (remainingCount + skipCount === 0) {
		console.log('\nNo images to download and save...');
	} else {
		console.log(`\nDownloading and saving ${remainingCount} images (${skipCount} already exist)...`);
		await processPayloadsPromise(payloads, loadImageFilePromise);
	}
}

async function loadImageFilePromise(imageUrl) {
	// only encode the URL if it doesn't already have encoded characters
	const url = (/%[\da-f]{2}/i).test(imageUrl) ? imageUrl : encodeURI(imageUrl);

	let buffer;
	try {
		buffer = await requestPromiseNative.get({
			url,
			encoding: null, // preserves binary encoding
			headers: {
				'User-Agent': 'wordpress-export-to-markdown'
			}
		});
	} catch (ex) {
		if (ex.name === 'StatusCodeError') {
			// these errors contain a lot of noise, simplify to just the status code
			ex.message = ex.statusCode;
		}
		throw ex;
	}
	return buffer;
}

function getPostPath(post, config) {
	let dt;
	if (settings.custom_date_formatting) {
		dt = luxon.DateTime.fromFormat(post.frontmatter.date, settings.custom_date_formatting);
	} else {
		dt = luxon.DateTime.fromISO(post.frontmatter.date);
	}

	// start with base output dir
	const pathSegments = [config.output, "posts"];

	// create segment for post type if we're dealing with more than just "post"
	if (config.includeOtherTypes) {
		pathSegments.push(post.meta.type);
	}

	if (config.yearFolders) {
		pathSegments.push(dt.toFormat('yyyy'));
	}

	if (config.monthFolders) {
		pathSegments.push(dt.toFormat('LL'));
	}

	// create slug fragment, possibly date prefixed
	let slugFragment = post.meta.slug;
	if (config.prefixDate) {
		slugFragment = dt.toFormat('yyyy-LL-dd') + '-' + slugFragment;
	}

	// use slug fragment as folder or filename as specified
	if (config.postFolders) {
		pathSegments.push(slugFragment, 'index.md');
	} else {
		pathSegments.push(slugFragment + '.md');
	}

	return path.join(...pathSegments);
}

function checkFile(path) {
	return fs.existsSync(path);
}

async function writeCategoryFilesPromise(categories, config) {
	// console.log(categories, config);
	// package up posts into payloads
	let skipCount = 0;
	let delay = 0;
	const payloads = categories.flatMap(category => {
		const destinationPath = getCategoryPath(category, config);
		if (checkFile(destinationPath)) {
			// already exists, don't need to save again
			skipCount++;
			return [];
		} else {
			const payload = {
				item: category,
				name: category.frontmatter.slug,
				destinationPath,
				delay
			};
			delay += settings.markdown_file_write_delay;
			return [payload];
		}
	});

	const remainingCount = payloads.length;
	if (remainingCount + skipCount === 0) {
		console.log('\nNo categories to download and save...');
	} else {
		console.log(`\nSaving ${remainingCount} categories (${skipCount} already exist)...`);
		await processPayloadsPromise(payloads, loadCategoryFilePromise);
	}
}

async function loadCategoryFilePromise(category) {
	let output = '---\n';

	Object.entries(category.frontmatter).forEach(([key, value]) => {
		let outputValue;
		if (Array.isArray(value)) {
			if (value.length > 0) {
				// array of one or more strings
				outputValue = value.reduce((list, item) => `${list}\n  - ${item}`, '');
			}
		} else {
			// console.log(key);
			let shouldEscape = ['title', 'description'].includes(key);

			if(shouldEscape) {
				// single string value
				const escapedValue = (value || '').replace(/"/g, '\\"');
				if (escapedValue.length > 0) {
					outputValue = `"${escapedValue}"`;
				}				
			} else
			{
				// single string value
				value = (value || '');
				if (value.length > 0) {
					outputValue = `${value}`;
				}
			}

		}

		if (outputValue !== undefined) {
			output += `${key}: ${outputValue}\n`;
		}
	});

	output += `---\n\n${category.content}\n`;


	return output;
}

function getCategoryPath(category, config) {
	const pathSegments = [config.output];

	pathSegments.push('categories');
	pathSegments.push(category.frontmatter.slug);
	pathSegments.push('_index.md')

	return path.join(...pathSegments)
}

//

async function writeAuthorFilesPromise(authors, config) {
	// console.log(categories, config);
	// package up posts into payloads
	let skipCount = 0;
	let delay = 0;
	const payloads = authors.flatMap(author => {
		const destinationPath = getAuthorPath(author, config);
		if (checkFile(destinationPath)) {
			// already exists, don't need to save again
			skipCount++;
			return [];
		} else {
			const payload = {
				item: author,
				name: author.frontmatter.slug || urlize(author.frontmatter.title),
				destinationPath,
				delay
			};
			delay += settings.markdown_file_write_delay;
			return [payload];
		}
	});

	const remainingCount = payloads.length;
	if (remainingCount + skipCount === 0) {
		console.log('\nNo authors to download and save...');
	} else {
		console.log(`\nSaving ${remainingCount} authors (${skipCount} already exist)...`);
		await processPayloadsPromise(payloads, loadAuthorFilePromise);
	}
}

async function loadAuthorFilePromise(author) {
	let output = '---\n';

	Object.entries(author.frontmatter).forEach(([key, value]) => {
		let outputValue;
		if (Array.isArray(value)) {
			if (value.length > 0) {
				// array of one or more strings
				outputValue = value.reduce((list, item) => `${list}\n  - ${item}`, '');
			}
		} else {
			// console.log(key);
			let shouldEscape = ['title', 'displayName', 'bio', 'email', 'slug'].includes(key);

			if(shouldEscape) {
				// single string value
				const escapedValue = (value || '').replace(/"/g, '\\"');
				if (escapedValue.length > 0) {
					outputValue = `"${escapedValue}"`;
				}				
			} else
			{
				// single string value
				value = (value || '');
				if (value.length > 0) {
					outputValue = `${value}`;
				}
			}

		}

		if (outputValue !== undefined) {
			output += `${key}: ${outputValue}\n`;
		}
	});

	output += `---\n\n${author.content}\n`;


	return output;
}

function getAuthorPath(author, config) {
	const pathSegments = [config.output];

	pathSegments.push('authors');
	let slug = urlize(author.frontmatter.title) 
	pathSegments.push(slug);
	pathSegments.push('_index.md')

	return path.join(...pathSegments)
}


function urlize(str) {
	// Convert the string to lowercase
	str = str.toLowerCase();
  
	// normalize and remove accents
	str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

	// Remove special characters, replace spaces with dashes
	str = str.replace(/[^\w\s-.]/g, '').replace(/\s+/g, '-');
  
	// Remove leading and trailing dashes
	str = str.replace(/^-+|-+$/g, '');
  
	return str;
  }

exports.writeFilesPromise = writeFilesPromise;
