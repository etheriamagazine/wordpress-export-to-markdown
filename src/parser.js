const fs = require('fs');
const requireDirectory = require('require-directory');
const xml2js = require('xml2js');

const shared = require('./shared');
const settings = require('./settings');
const translator = require('./translator');

const luxon = require('luxon');


// dynamically requires all frontmatter getters
const frontmatterGetters = requireDirectory(module, './frontmatter', { recurse: false });

async function parseFilePromise(config) {
  console.log('\nParsing...');
  const content = await fs.promises.readFile(config.input, 'utf8');
  const allData = await xml2js.parseStringPromise(content, {
    trim: true,
    tagNameProcessors: [xml2js.processors.stripPrefix],
  });
  const channelData = allData.rss.channel[0].item;
  const categoryData = allData.rss.channel[0].category;
  const authorData = allData.rss.channel[0].author;

  const postTypes = getPostTypes(channelData, config);
  const slugTokens = getSlugTokens(channelData, postTypes);
  const posts = collectPosts(channelData, postTypes, slugTokens, config);
  const categories = collectCategories(categoryData, config);
  const authors = collectAuthors(authorData, config);

  const images = [];

  // collect image data always for metadata processing
  images.push(...collectAttachedImages(channelData));
  images.push(...collectScrapedImages(channelData, postTypes));

  mergeImagesIntoPosts(images, posts);
  populateFrontmatter(posts);

  return [posts, categories, authors];
}

function getPostTypes(channelData, config) {
  if (config.includeOtherTypes) {
    // search export file for all post types minus some default types we don't want
    // effectively this will be 'post', 'page', and custom post types
    const types = channelData
      .map((item) => item.post_type[0])
      .filter(
        (type) =>
          ![
            'attachment',
            'revision',
            'nav_menu_item',
            'custom_css',
            'customize_changeset',
          ].includes(type)
      );
    return [...new Set(types)]; // remove duplicates
  } else {
    // just plain old vanilla "post" posts
    return ['post'];
  }
}

function getItemsOfType(channelData, type) {
  return channelData.filter((item) => item.post_type[0] === type);
}

function collectPosts(channelData, postTypes, routeTokenTable, config) {
  // this is passed into getPostContent() for the markdown conversion
  const turndownService = translator.initTurndownService(routeTokenTable);

  let allPosts = [];
  postTypes.forEach((postType) => {
    const postsForType = getItemsOfType(channelData, postType)
      .filter((postData) => postData.status[0] !== 'trash' && postData.status[0] !== 'draft')
      .map((postData) => ({
        // raw post data, used by frontmatter getters
        data: postData,

        // meta data isn't written to file, but is used to help with other things
        meta: {
          id: getPostId(postData),
          slug: getPostSlug(postData),
          coverId: getPostCoverImageId(postData),
          cover: undefined, // possibly set later in mergeImagesIntoPosts()
          type: postType,
          imageUrls: [], // possibly set later in mergeImagesIntoPosts()
        },

        // contents of the post in markdown
        content: translator.getPostContent(postData, turndownService, config),
      }));

    if (postTypes.length > 1) {
      console.log(`${postsForType.length} "${postType}" posts found.`);
    }

    allPosts.push(...postsForType);
  });

  if (postTypes.length === 1) {
    console.log(allPosts.length + ' posts found.');
  }
  return allPosts;
  //.filter(post => post.meta.slug == 'viaje-romantico-costa-amalfitana');
}

// 
function getSlugTokens(channelData, postTypes) {
  let oldSlugs = {};
  let currentSlugs = {};
  postTypes.forEach((postType) => {
    getItemsOfType(channelData, postType)
      .filter((postData) => postData.status[0] !== 'trash' && postData.status[0] !== 'draft')
      .forEach((postData) => {
        const slug = getPostSlug(postData);

		// whenever an article in WordPress gets republished, links may be outdated not only because
		// the slug may have changed, but because the publish date gets updated.
		// Our best bet is to use the current publish date to make the path of the old links
		// work again.
		const pubdate = luxon.DateTime.fromRFC2822(postData.pubDate[0], { zone: 'utc' }).toISODate();
		const year = pubdate.substring(0, 4);
		const month = pubdate.substring(5, 7);
		const day = pubdate.substring(8);
		
		// add first all _wp_old_slug found for the post
        postData.postmeta
          .filter((postmeta) => postmeta.meta_key[0] === '_wp_old_slug')
          .forEach((postmeta) => {
            const oldSlug = postmeta ? postmeta.meta_value[0] : undefined;
            if (oldSlug) {
              oldSlugs = { ...oldSlugs, ...{ [oldSlug]: { slug, year, month, day } }};
            }
          });
		
		// and also the current slug
		currentSlugs = { ...currentSlugs, ...{[slug]: { slug, year, month, day } } }
      });
  });

  var oldCount = Object.entries(oldSlugs).length;
  var currentCount = Object.entries(currentSlugs).length;

  console.log(`\nFound ${oldCount + currentCount} slugs. Old: ${oldCount}, Current: ${currentCount}`);

  return {...currentSlugs, ...oldSlugs };
}

function getPostId(postData) {
  return postData.post_id[0];
}

function getPostSlug(postData) {
  return decodeURIComponent(postData.post_name[0]);
}

function getPostCoverImageId(postData) {
  if (postData.postmeta === undefined) {
    return undefined;
  }

  const postmeta = postData.postmeta.find((postmeta) => postmeta.meta_key[0] === '_thumbnail_id');
  const id = postmeta ? postmeta.meta_value[0] : undefined;
  return id;
}

function collectAttachedImages(channelData) {
  const images = getItemsOfType(channelData, 'attachment')
    // filter to certain image file types
    .filter((attachment) => /\.(gif|jpe?g|png)$/i.test(attachment.attachment_url[0]))
    .map((attachment) => ({
      id: attachment.post_id[0],
      postId: attachment.post_parent[0],
      url: attachment.attachment_url[0],
    }));

  console.log(images.length + ' attached images found.');
  return images;
}

function collectScrapedImages(channelData, postTypes) {
  const images = [];
  postTypes.forEach((postType) => {
    getItemsOfType(channelData, postType).forEach((postData) => {
      const postId = postData.post_id[0];
      const postContent = postData.encoded[0];
      const postLink = postData.link[0];

      const matches = [...postContent.matchAll(/<img[^>]*src="(.+?\.(?:gif|jpe?g|png))"[^>]*>/gi)];
      matches.forEach((match) => {
        // base the matched image URL relative to the post URL
        const url = new URL(match[1], postLink).href;
        images.push({
          id: -1,
          postId: postId,
          url,
        });
      });
    });
  });

  console.log(images.length + ' images scraped from post body content.');
  return images;
}

function mergeImagesIntoPosts(images, posts) {
  console.log('images:' + images.length);
  console.log('posts:' + posts.length);

  images.forEach((image) => {
    posts.forEach((post) => {
      let shouldAttach = false;

      // this image was uploaded as an attachment to this post
      if (image.postId === post.meta.id) {
        shouldAttach = true;
      }

      // this image was set as the featured image for this post
      if (image.id === post.meta.coverId) {
        shouldAttach = true;
        post.meta.cover = image.url; // shared.getFilenameFromUrl(image.url);
      }

      if (shouldAttach && !post.meta.imageUrls.includes(image.url)) {
        post.meta.imageUrls.push(image.url);
      }
    });
  });
}

function populateFrontmatter(posts) {
  posts.forEach((post) => {
    const frontmatter = {};
    settings.frontmatter_fields.forEach((field) => {
      [key, alias] = field.split(':');

      let frontmatterGetter = frontmatterGetters[key];
      if (!frontmatterGetter) {
        throw `Could not find a frontmatter getter named "${key}".`;
      }

      frontmatter[alias || key] = frontmatterGetter(post);
    });
    post.frontmatter = frontmatter;
  });
}

function collectCategories(categoriesData, config) {
  return settings.new_categories.map((item) => ({
    frontmatter: {
      title: item.title,
      slug: item.slug,
      description: item.description,
    },
    content: '',
  }));

  return categoriesData
    .map((item) => ({
      frontmatter: {
        title: convertToTitleCase(item.cat_name[0]),
        slug: slugize(settings.translateCategory(item.category_nicename[0])),
        description: (item.category_description && item.category_description[0]) || '',
      },
      content: '',
    }))
    .filter((category) => category.frontmatter.slug != null);
}

function convertToTitleCase(str) {
  if (!str) {
    return '';
  }
  return str.charAt(0).toUpperCase() + str.substr(1).toLowerCase();
}

function collectAuthors(authorData, config) {
  return authorData.map((item) => {
    let title = settings.translateAuthor(item.author_login[0]);

    // let slug = settings.getAuthor(item.author_login[0]).slug
    // 	|| (/[À-ž.]/g.test(title) ? slugize(title): '');

    return {
      frontmatter: {
        title: settings.translateAuthor(item.author_login[0]),
        // slug: slug,
        displayName: settings.getAuthor(item.author_login[0]).displayName,
        email: item.author_email[0],
        bio: settings.getAuthor(item.author_login[0]).bio,
        jobTitle: settings.getAuthor(item.author_login[0]).jobTitle,
        knowsAbout: settings.getAuthor(item.author_login[0]).knowsAbout,
        urls: settings.getAuthor(item.author_login[0]).urls,
      },
      content: '',
    };
  });
}

exports.parseFilePromise = parseFilePromise;

function slugize(str) {
  if (str == null) return null;

  // Convert the string to lowercase
  str = str.toLowerCase();

  // normalize and remove accents
  str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Remove special characters, replace spaces with dashes
  str = str.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');

  // Remove leading and trailing dashes
  str = str.replace(/^-+|-+$/g, '');

  return str;
}
