/* tslint:disable:quotemark */

import * as _ from 'lodash';
import * as urlHelper from 'url';


import { domain as extractDomain } from '../bbcode/core';

export interface PreviewMutator {
    match: string | RegExp;
    injectJs: string;
    eventName: string;

    urlMutator?(url: string): string;
}

export interface ImagePreviewMutatorCollection {
    [key: string]: PreviewMutator;
}


export class ImagePreviewMutator {
    // tslint:disable: prefer-function-over-method
    private hostMutators: ImagePreviewMutatorCollection = {};
    private regexMutators: PreviewMutator[] = [];
    private debug: boolean;

    constructor(debug: boolean) {
        this.init();

        this.debug = debug;
    }

    setDebug(debug: boolean): void {
        this.debug = debug;
    }


    mutateUrl(url: string): string {
        const mutator = this.matchMutator(url);

        if ((!mutator) || (!mutator.urlMutator))
            return url;

        return mutator.urlMutator(url);
    }


    getMutatorJsForSite(url: string, eventName: string): string | undefined {
        let mutator = this.matchMutator(url);

        if (!mutator)
            mutator = this.hostMutators['default'];

        if (mutator.eventName !== eventName)
            return;

        return this.wrapJs(mutator.injectJs) + this.getReShowMutator();
    }

    matchMutator(url: string): PreviewMutator | undefined {
        const urlDomain = extractDomain(url);

        if (!urlDomain)
            return;

        if (urlDomain in this.hostMutators)
            return this.hostMutators[urlDomain];

        return _.find(
            this.regexMutators,
            (m: PreviewMutator) => {
                const match = m.match;

                return (match instanceof RegExp) ? (urlDomain.match(match) !== null) : (match === urlDomain);
            }
        );
    }

    protected wrapJs(mutatorJs: string): string {
        return `(() => { try { ${mutatorJs} } catch (err) { console.error('Mutator error', err); } })();`;
    }

    protected add(
        domain: string | RegExp,
        mutatorJs: string,
        urlMutator?: (url: string) => string,
        eventName: string = 'update-target-url'
    ): void {
        if (domain instanceof RegExp) {
            this.regexMutators.push(
                {
                    match: domain,
                    injectJs: mutatorJs,
                    urlMutator,
                    eventName
                }
            );

            return;
        }

        this.hostMutators[domain] = {
            match: domain,
            injectJs: mutatorJs,
            urlMutator,
            eventName
        };
    }

    protected init(): void {
        this.add('default', this.getBaseJsMutatorScript(['#video, video', '#image, img']));
        this.add('e621.net', this.getBaseJsMutatorScript(['video', '#image']));
        this.add('e-hentai.org', this.getBaseJsMutatorScript(['video', '#img']));
        this.add('gelbooru.com', this.getBaseJsMutatorScript(['video', '#image']));
        this.add('chan.sankakucomplex.com', this.getBaseJsMutatorScript(['video', '#image']));
        this.add('danbooru.donmai.us', this.getBaseJsMutatorScript(['video', '#image']));
        this.add('gfycat.com', this.getBaseJsMutatorScript(['video']), undefined, 'dom-ready');
        this.add('gfycatporn.com', this.getBaseJsMutatorScript(['video']), undefined, 'dom-ready');
        this.add('youtube.com', this.getBaseJsMutatorScript(['video']), undefined, 'dom-ready');
        this.add('instantfap.com', this.getBaseJsMutatorScript(['#post video', '#post img']));
        this.add('webmshare.com', this.getBaseJsMutatorScript(['video']));
        this.add('pornhub.com', this.getBaseJsMutatorScript(['.mainPlayerDiv video', '.photoImageSection img']));
        this.add('sex.com', this.getBaseJsMutatorScript(['.image_frame video', '.image_frame img']));
        this.add('redirect.media.tumblr.com', this.getBaseJsMutatorScript(['picture video', 'picture img']));
        this.add('postimg.cc', this.getBaseJsMutatorScript(['video', '#main-image']));
        this.add('gifsauce.com', this.getBaseJsMutatorScript(['video']));
        this.add('motherless.com', this.getBaseJsMutatorScript(['.content video', '.content img']));
        this.add(/^media[0-9]\.giphy\.com$/, this.getBaseJsMutatorScript(['video', 'img[alt]']));
        this.add('giphy.com', this.getBaseJsMutatorScript(['video', 'a > div > img']));
        this.add(/^media[0-9]\.tenor\.com$/, this.getBaseJsMutatorScript(['#view .file video', '#view .file img']));
        this.add('tenor.com', this.getBaseJsMutatorScript(['#view video', '#view img']));

        // tslint:disable max-line-length
        this.add(
            'i.imgur.com',
            `
                const imageCount = (new URL(window.location.href)).searchParams.get('flist_gallery_image_count');

                ${this.getBaseJsMutatorScript(['video', 'img'])}

                if(imageCount > 1) {
                    ${this.injectHtmlJs('<div id="imageCount" style="z-index: 1000000; position: absolute; bottom: 0; right: 0; background: green; border: 2px solid lightgreen; width: 5rem; height: 5rem; font-size: 2rem; font-weight: bold; color: white; border-radius: 5rem; margin: 0.75rem;"><div id="imageCountInner" style="position: absolute; top: 50%; left: 50%; transform: translateY(-50%) translateX(-50%);"></div></div>')}

                    const imageCountEl = document.getElementById('imageCountInner');

                    if (imageCountEl) {
                        imageCountEl.innerHTML = '+' + (imageCount - 1);
                    }
                }
            `
        );

        // tslint:disable max-line-length
        this.add(
            'imgur.com',
            `
                const imageCount = $('.post-container video, .post-container img').length;

                ${this.getBaseJsMutatorScript(['.post-container video', '.post-container img'], true)}

                if(imageCount > 1)
                    $('#flistWrapper').append('<div id="imageCount" style="position: absolute; bottom: 0; right: 0; background: green; border: 2px solid lightgreen; width: 5rem; height: 5rem; font-size: 2rem; font-weight: bold; color: white; border-radius: 5rem; margin: 0.75rem;"><div style="position: absolute; top: 50%; left: 50%; transform: translateY(-50%) translateX(-50%);">+' + (imageCount - 1) + '</div></div>');
            `
        );

        this.add(
            'rule34.xxx',
            `${this.getBaseJsMutatorScript(['video', '#image'])}
                const content = document.querySelector('#content');

                if (content) content.remove();
            `,
            undefined,
            'dom-ready'
        );


        this.add(
            'hentai-foundry.com',
            this.getBaseJsMutatorScript(['main video', 'main img']),
            (url: string): string => {
                const u = urlHelper.parse(url, true);

                if (!u)
                    return url;

                // tslint:disable-next-line no-any
                (u.query as any).enterAgree = 1;

                delete u.search;

                return urlHelper.format(u);
            }
        );
    }

    getBaseJsMutatorScript(elSelector: string[], skipElementRemove: boolean = false): string {
        return `const { ipcRenderer } = require('electron');
            const body = document.querySelector('body');
            const html = document.querySelector('html');
            const selectors = ${JSON.stringify(elSelector)};

            // writing this out because sometimes .map and .reduce are overridden
            let selected = [];

            for (selector of selectors) {
                const selectedElements = (Array.from(document.querySelectorAll(selector)).filter((i) => ((i.width !== 1) && (i.height !== 1))));
                selected = selected.concat(selectedElements);
            }

            ${this.debug ? `console.log('Selector', '${elSelector.toString()}'); console.log('Selected', selected);` : ''}

            const img = selected.shift();

            ${this.debug ? `console.log('Img', img);` : ''}

            if (!img) { return; }

            ipcRenderer.sendToHost('webview.img', img.width || img.naturalWidth || img.videoWidth, img.height || img.naturalHeight || img.videoHeight);

            const el = document.createElement('div');
            el.id = 'flistWrapper';

            el.style = 'width: 100% !important; height: 100% !important; position: absolute !important;'
                + 'top: 0 !important; left: 0 !important; z-index: 100000 !important;'
                + 'background-color: black !important; background-size: contain !important;'
                + 'background-repeat: no-repeat !important; background-position: top left !important;'
                + 'opacity: 1 !important; padding: 0 !important; border: 0 !important; margin: 0 !important;'
                + 'min-width: unset !important; min-height: unset !important; max-width: unset !important; max-height: unset !important;';

            try {
                img.remove();
            } catch(err) {
                console.error('Failed remove()', err);

                try {
                    img.parentNode.removeChild(img);
                } catch(err2) {
                    console.error('Failed removeChild()', err2);
                }
            }

            el.append(img);
            body.append(el);
            body.class = '';

            body.style = 'border: 0 !important; padding: 0 !important; margin: 0 !important; overflow: hidden !important;'
                + 'width: 100% !important; height: 100% !important; opacity: 1 !important;'
                + 'top: 0 !important; left: 0 !important; position: absolute !important;'
                + 'min-width: unset !important; min-height: unset !important; max-width: unset !important; max-height: unset !important;';

            img.style = 'object-position: top left !important; object-fit: contain !important;'
                + 'width: 100% !important; height: 100% !important; opacity: 1 !important;'
                + 'margin: 0 !imporant; border: 0 !important; padding: 0 !important;'
                + 'min-width: unset !important; min-height: unset !important; max-width: unset !important; max-height: unset !important;';

            img.class = '';
            el.class = '';
            html.class = '';

            html.style = 'border: 0 !important; padding: 0 !important; margin: 0 !important; overflow: hidden !important;'
                + 'width: 100% !important; height: 100% !important; opacity: 1 !important;'
                + 'top: 0 !important; left: 0 !important; position: absolute !important;'
                + 'min-width: unset !important; min-height: unset !important; max-width: unset !important; max-height: unset !important;';

            ${this.debug ? "console.log('Wrapper', el);" : ''}

            if ((!img.src) && (img.tagName) && (img.tagName.toUpperCase() === 'VIDEO')) {
                ${this.debug ? "console.log('Nedds a content URL', img);" : ''}

                const contentUrls = document.querySelectorAll('meta[itemprop="contentURL"]');

                if ((contentUrls) && (contentUrls.length > 0)) {
                    ${this.debug ? "console.log('Found content URLs', contentUrls);" : ''}

                    const cu = contentUrls[0];

                    if ((cu.attributes) && (cu.attributes.content) && (cu.attributes.content.value)) {
                        ${this.debug ? "console.log('Content URL', cu.attributes.content.value);" : ''}

                        img.src = cu.attributes.content.value;
                    }
                }
            }

            document.addEventListener('DOMContentLoaded', (event) => {
                ${this.debug ? "console.log('on DOMContentLoaded');" : ''}

                ipcRenderer.sendToHost('webview.img', img.width || img.naturalWidth, img.height || img.naturalHeight);

                if (
                    (img.play)
                    && ((!img.paused) && (!img.ended) && (!(img.currentTime > 0)))
                )
                { img.muted = true; img.loop = true; img.play(); }
            });

            document.addEventListener('load', (event) => {
                ${this.debug ? "console.log('on load');" : ''}

                ipcRenderer.sendToHost('webview.img', img.width || img.naturalWidth, img.height || img.naturalHeight);

                if (
                    (img.play)
                    && ((!img.paused) && (!img.ended) && (!(img.currentTime > 0)))
                )
                { img.muted = true; img.loop = true; img.play(); }
            });


            try {
                if (img.play) { img.muted = true; img.loop = true; img.play(); }
            } catch (err) {
                console.error('Failed img.play()', err);
            }


            let removeList = [];
            const safeIds = ['flistWrapper', 'flistError', 'flistHider'];

            body.childNodes.forEach((el) => ((safeIds.indexOf(el.id) < 0) ? removeList.push(el) : true));

            ${skipElementRemove ? '' : 'removeList.forEach((el) => el.remove());'}
            removeList = [];
        `;
    }

    getErrorMutator(code: number, description: string): string {
        const errorHtml = `
            <div id="flistError" style="
                width: 100% !important;
                height: 100% !important;
                background-color: black !important;
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                z-index: 200000 !important;
                margin: 0 !important;
                padding: 0 !important;
                line-height: 100% !important;
                border: 0 !important;
                opacity: 1 !important;
                text-align: center !important;
            "><h1 style="
                color: #FF4444 !important;
                font-size: 45pt !important;
                margin: 0 !important;
                margin-top: 10pt !important;
                line-height: 100% !important;
                padding: 0 !important;
                border: 0 !important;
                background: none !important;
                font-family: Helvetica, Arial, sans-serif !important;
                font-weight: bold !important;
            ">${code}</h1><p style="
                max-width: 400px !important;
                color: #ededed !important;
                display: inline-block !important;
                font-size: 15pt !important;
                font-family: Helvetica, Arial, sans-serif !important;
                font-weight: 300 !important;
                border: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                margin-top: 5pt !important;
                line-height: 130% !important;
            ">${description}</p></div>
        `;

        return this.injectHtmlJs(errorHtml);
    }

    protected injectHtmlJs(html: string): string {
        return this.wrapJs(`
            const range = document.createRange();

            range.selectNode(document.body);

            const error = range.createContextualFragment(\`${html}\`);

            document.body.appendChild(error);
        `);
    }

    getHideMutator(): string {
        return this.injectHtmlJs(`
            <div id="flistHider" style="
                width: 100% !important;
                height: 100% !important;
                background-color: black !important;
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                z-index: 300000 !important;
                margin: 0 !important;
                padding: 0 !important;
                line-height: 100% !important;
                border: 0 !important;
                opacity: 1 !important;
                text-align: center !important;
            "></div>
        `) + this.wrapJs(
            `
                window.__flistUnhide = () => {
                    const elements = document.querySelectorAll('#flistHider');

                    if (elements) {
                        elements.forEach( (el) => el.remove() );
                    }
                };
            `
        );
    }

    getReShowMutator(): string {
        return this.wrapJs(
            `
            const elements = document.querySelectorAll('#flistHider');

            if (elements) {
                elements.forEach( (el) => el.remove() );
            }
            `
        );
    }
}
