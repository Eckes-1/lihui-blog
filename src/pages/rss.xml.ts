import rss from "@astrojs/rss";
import { getAllPosts } from "../utils/api"
import { getDynamicSiteConfig, getDynamicProfileConfig } from '../utils/dynamic-config';
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
    const [siteConfig, profileConfig, postsData] = await Promise.all([
      getDynamicSiteConfig(),
      getDynamicProfileConfig(),
      getAllPosts()
    ]);
    const blog = postsData.posts || [];
    return rss({
        title: `${siteConfig.title} - ${siteConfig.subTitle}`,
        description: profileConfig.description,
        site: context.site ?? "https://momo.motues.top",
        items: blog.slice(0, 20).map((post: any) => ({
            title: post.title,
            pubDate: new Date(post.pub_date),
            description: post.description,
            link: `/blog/${post.slug_id || post.id}/`,
        })),
    })
}
