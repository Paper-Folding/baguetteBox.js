/*!
 * baguetteBox.js
 * @author  Paper-Folding
 * @url https://github.com/Paper-Folding/baguetteBox.js
 */

/* global define, module */

(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        define(factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        root.baguetteBox = factory();
    }
}(this, function () {
    'use strict';

    // SVG shapes used on the buttons
    var leftArrow = '<svg width="44" height="60">' +
        '<polyline points="30 10 10 30 30 50" stroke="rgba(255,255,255,0.5)" stroke-width="4"' +
        'stroke-linecap="butt" fill="none" stroke-linejoin="round"/>' +
        '</svg>',
        rightArrow = '<svg width="44" height="60">' +
            '<polyline points="14 10 34 30 14 50" stroke="rgba(255,255,255,0.5)" stroke-width="4"' +
            'stroke-linecap="butt" fill="none" stroke-linejoin="round"/>' +
            '</svg>',
        closeX = '<svg width="30" height="30">' +
            '<g stroke="rgb(160,160,160)" stroke-width="4">' +
            '<line x1="5" y1="5" x2="25" y2="25"/>' +
            '<line x1="5" y1="25" x2="25" y2="5"/>' +
            '</g></svg>';
    // Global options and their defaults
    var options = {},
        defaults = {
            captions: true,
            buttons: 'auto',
            fullScreen: false,
            noScrollbars: false,
            bodyClass: 'baguetteBox-open',
            titleTag: false,
            async: false,
            preload: 2,
            animation: 'slideIn',
            afterShow: null,
            afterHide: null,
            onChange: null,
            overlayBackgroundColor: 'rgba(0,0,0,.8)',
            dblTrigger: false,
            singleClickCallBack: null,
            doubleClickJudgeTimeout: 200,
            scalable: false,
            customContextMenuEnabled: false,
            initialImageURIList: []
        };
    // Object containing information about features compatibility
    var supports = {};
    // DOM Elements references
    var overlay, slider, previousButton, nextButton, closeButton;
    // An array with all images in the current gallery
    var currentGallery = [];
    // Current image index inside the slider
    var currentIndex = 0;
    // Visibility of the overlay
    var isOverlayVisible = false;
    // Touch event start position (for slide gesture)
    var touch = {};
    // Regex pattern to match image & video files
    var regex = /.+\.(gif|jpe?g|png|webp|mp4|webm)/i;
    // Pattern to match only videos
    var videoRegex = /.+\.(mp4|webm)/i;
    // Object of all used galleries
    var data = {};
    // Array containing temporary images DOM elements
    var imagesElements = [];
    // The last focused element before opening the overlay
    var documentLastFocus = null;
    var scaleRate = 1;
    var overlayClickHandler = (() => {
        let timeout, click = 0;
        return (event) => {
            touch.endTime = new Date().getTime();
            // let contextMenu = $('.bagueteeBox-context-menu');
            if (isLongPressing()) {
                // !!! long press code
                $('#baguetteBox-slider .full-image').contextMenu({ x: event.pageX, y: event.pageY })
                return;
            }
            // Close the overlay when user clicks directly on the background
            if (event.target.id.indexOf('baguette-img') !== -1) {
                let area = window.innerHeight * 0.2;
                if (event.pageY < area || event.pageY > window.innerHeight - area)
                    hideOverlay();
                else {
                    if (event.pageX < window.innerWidth / 2)
                        showPreviousImage();
                    else
                        showNextImage();
                }
            }
            else {
                if (options.scalable) {
                    click++;
                    clearTimeout(timeout);
                    timeout = setTimeout(() => {
                        if (click === 1) {
                            // !!! single click code
                            if (event.offsetX < event.target.offsetWidth / 2) // video element cannot obtain width by event.target.width, so I use window width here instead
                                showPreviousImage();
                            else
                                showNextImage();
                        }
                        else if (click === 2) {
                            // !!! double click code
                            let classList = event.target.classList;
                            event.target.style.transformOrigin = event.offsetX + 'px ' + event.offsetY + 'px';
                            switch (scaleRate) {
                                case 0.8:
                                    scaleRate = 1;
                                    break;
                                case 1:
                                    scaleRate = 2;
                                    break;
                                case 2:
                                    scaleRate = 3;
                                    break;
                                default:
                                    scaleRate = 0.8;
                            }
                            event.target.style.setProperty('--scale-rate', scaleRate);
                            classList.add('scale');
                        }
                        else if (click === 3) {
                            // !!! triple click code
                            hideOverlay();
                        }
                        click = 0;
                    }, options.doubleClickJudgeTimeout);

                }
            }
        }
    })();
    var previousButtonClickHandler = function (event) {
        event.stopPropagation ? event.stopPropagation() : event.cancelBubble = true; // eslint-disable-line no-unused-expressions
        showPreviousImage();
    };
    var nextButtonClickHandler = function (event) {
        event.stopPropagation ? event.stopPropagation() : event.cancelBubble = true; // eslint-disable-line no-unused-expressions
        showNextImage();
    };
    var closeButtonClickHandler = function (event) {
        event.stopPropagation ? event.stopPropagation() : event.cancelBubble = true; // eslint-disable-line no-unused-expressions
        hideOverlay();
    };
    var touchstartHandler = function () {
        touch.startTime = new Date().getTime();
        touch.isLongPressing = false;
    };
    var touchendHandler = function (event) {
        event.stopPropagation();
    };

    function isLongPressing() {
        return Math.abs(touch.startTime - touch.endTime) >= 300;
    }

    var trapFocusInsideOverlay = function (event) {
        if (overlay.style.display === 'block' && (overlay.contains && !overlay.contains(event.target))) {
            event.stopPropagation();
            initFocus();
        }
    };

    // forEach polyfill for IE8
    // http://stackoverflow.com/a/14827443/1077846
    /* eslint-disable */
    if (![].forEach) {
        Array.prototype.forEach = function (callback, thisArg) {
            for (var i = 0; i < this.length; i++) {
                callback.call(thisArg, this[i], i, this);
            }
        };
    }

    // filter polyfill for IE8
    // https://gist.github.com/eliperelman/1031656
    if (![].filter) {
        Array.prototype.filter = function (a, b, c, d, e) {
            c = this;
            d = [];
            for (e = 0; e < c.length; e++)
                a.call(b, c[e], e, c) && d.push(c[e]);
            return d;
        };
    }
    /* eslint-enable */

    // Script entry point
    function run(selector, userOptions) {
        // Fill supports object
        supports.transforms = testTransformsSupport();
        supports.svg = testSvgSupport();
        supports.passiveEvents = testPassiveEventsSupport();

        buildOverlay(userOptions);
        removeFromCache(selector);
        // user do go back operation to close self
        window.onhashchange = () => {
            if (location.hash !== '#baguette')
                hideOverlay();
        }

        if (userOptions.initialImageURIList && userOptions.initialImageURIList.length > 0) {
            return bindImageListClickListeners(selector, userOptions);
        }

        return bindImageClickListeners(selector, userOptions);
    }

    function addMore() {
        let tagsNodeList = paper_container.getElementsByTagName('a');
        let newTagsNodeList = [];
        let oldList = data[Object.keys(data)[0]].galleries[0];
        var gallery = [], oldLength = oldList.length;
        [].forEach.call(tagsNodeList, function (ele, index) {
            if (ele !== oldList[index]?.imageElement)
                newTagsNodeList.push(ele);
            else
                gallery.push(ele);
        });

        if (newTagsNodeList.length === 0) {
            return;
        }

        [].filter.call(newTagsNodeList, function (element) {
            if (element.className.indexOf(paper_userOptions && paper_userOptions.ignoreClass) === -1) {
                if (paper_userOptions.dblTrigger)
                    return regex.test(element.getAttribute('dblHref'));
                else
                    return regex.test(element.href);
            }
        });

        [].forEach.call(newTagsNodeList, function (imageElement, imageIndex) {
            var imageElementClickHandler = function (event) {
                event.preventDefault ? event.preventDefault() : event.returnValue = false; // eslint-disable-line no-unused-expressions
                prepareOverlay(data[Object.keys(data)[0]].galleries[0], paper_userOptions);
                showOverlay(oldLength + imageIndex);
            };
            var imageItem = {
                eventHandler: imageElementClickHandler,
                imageElement: imageElement
            };
            if (paper_userOptions.dblTrigger) // If double clicking to open overlay enabled
                // singleClickCallBack defines that: when and only when double click to open overlay is enabled, what shall do when single clicked
                bindSingleDoubleClickItems(imageElement, imageElementClickHandler, paper_userOptions);
            else // else just do last version's behaviors
                bind(imageElement, 'click', imageElementClickHandler);
            data[Object.keys(data)[0]].galleries[0].push({ imageElement: imageItem.imageElement, eventHandler: imageElementClickHandler });
        });

        return gallery;
    }

    var paper_container;
    var paper_userOptions;

    function bindImageListClickListeners(selector, userOptions) {
        // For each gallery bind a click event to every image inside it
        var galleryNodeList = document.querySelectorAll(selector);
        var selectorData = {
            galleries: [],
            nodeList: galleryNodeList
        };
        data[selector] = selectorData;

        [].forEach.call(galleryNodeList, function (galleryElement) {
            if (userOptions && userOptions.filter) {
                regex = userOptions.filter;
            }

            // Get nodes from gallery elements or single-element galleries
            var tagsNodeList = [];
            paper_container = galleryElement;
            if (galleryElement.tagName === 'A') {
                tagsNodeList = [galleryElement];
            } else {
                tagsNodeList = galleryElement.getElementsByTagName('a');
            }

            // Filter 'a' elements from those not linking to images
            tagsNodeList = [].filter.call(tagsNodeList, function (element) {
                if (element.className.indexOf(userOptions && userOptions.ignoreClass) === -1) {
                    if (userOptions.dblTrigger)
                        return regex.test(element.getAttribute('dblHref'));
                    else
                        return regex.test(element.href);
                }
            });
            if (tagsNodeList.length === 0) {
                return;
            }

            // setOptions calls after bind click listener, but doubleClickJudgeTimeout is eager to use its value during binding click listener
            if (typeof userOptions.doubleClickJudgeTimeout === 'undefined')
                userOptions.doubleClickJudgeTimeout = defaults.doubleClickJudgeTimeout;

            var gallery = [];
            [].forEach.call(tagsNodeList, function (imageElement, imageIndex) {
                var imageElementClickHandler = function (event) {
                    event.preventDefault ? event.preventDefault() : event.returnValue = false; // eslint-disable-line no-unused-expressions
                    prepareOverlay(gallery, userOptions);
                    showOverlay(imageIndex);
                };
                var imageItem = {
                    eventHandler: imageElementClickHandler,
                    imageElement: imageElement
                };
                if (userOptions.dblTrigger) // If double clicking to open overlay enabled
                    // singleClickCallBack defines that: when and only when double click to open overlay is enabled, what shall do when single clicked
                    bindSingleDoubleClickItems(imageElement, imageElementClickHandler, userOptions);
                else // else just do last version's behaviors
                    bind(imageElement, 'click', imageElementClickHandler);
                gallery.push(imageItem);
            });
            selectorData.galleries.push(gallery);
        });
        paper_userOptions = userOptions;
        return selectorData.galleries;
    }

    function bindImageClickListeners(selector, userOptions) {
        // For each gallery bind a click event to every image inside it
        var galleryNodeList = document.querySelectorAll(selector);
        var selectorData = {
            galleries: [],
            nodeList: galleryNodeList
        };
        data[selector] = selectorData;

        [].forEach.call(galleryNodeList, function (galleryElement) {
            if (userOptions && userOptions.filter) {
                regex = userOptions.filter;
            }

            // Get nodes from gallery elements or single-element galleries
            var tagsNodeList = [];
            paper_container = galleryElement;
            if (galleryElement.tagName === 'A') {
                tagsNodeList = [galleryElement];
            } else {
                tagsNodeList = galleryElement.getElementsByTagName('a');
            }

            // Filter 'a' elements from those not linking to images
            tagsNodeList = [].filter.call(tagsNodeList, function (element) {
                if (element.className.indexOf(userOptions && userOptions.ignoreClass) === -1) {
                    if (userOptions.dblTrigger)
                        return regex.test(element.getAttribute('dblHref'));
                    else
                        return regex.test(element.href);
                }
            });
            if (tagsNodeList.length === 0) {
                return;
            }

            // setOptions calls after bind click listener, but doubleClickJudgeTimeout is eager to use its value during binding click listener
            if (typeof userOptions.doubleClickJudgeTimeout === 'undefined')
                userOptions.doubleClickJudgeTimeout = defaults.doubleClickJudgeTimeout;

            var gallery = [];
            [].forEach.call(tagsNodeList, function (imageElement, imageIndex) {
                var imageElementClickHandler = function (event) {
                    event.preventDefault ? event.preventDefault() : event.returnValue = false; // eslint-disable-line no-unused-expressions
                    prepareOverlay(gallery, userOptions);
                    showOverlay(imageIndex);
                };
                var imageItem = {
                    eventHandler: imageElementClickHandler,
                    imageElement: imageElement
                };
                if (userOptions.dblTrigger) // If double clicking to open overlay enabled
                    // singleClickCallBack defines that: when and only when double click to open overlay is enabled, what shall do when single clicked
                    bindSingleDoubleClickItems(imageElement, imageElementClickHandler, userOptions);
                else // else just do last version's behaviors
                    bind(imageElement, 'click', imageElementClickHandler);
                gallery.push(imageItem);
            });
            selectorData.galleries.push(gallery);
        });
        paper_userOptions = userOptions;
        return selectorData.galleries;
    }

    function clearCachedData() {
        for (var selector in data) {
            if (data.hasOwnProperty(selector)) {
                removeFromCache(selector);
            }
        }
    }

    function removeFromCache(selector) {
        if (!data.hasOwnProperty(selector)) {
            return;
        }
        var galleries = data[selector].galleries;
        [].forEach.call(galleries, function (gallery) {
            [].forEach.call(gallery, function (imageItem) {
                unbind(imageItem.imageElement, 'click', imageItem.eventHandler);
            });

            if (currentGallery === gallery) {
                currentGallery = [];
            }
        });

        delete data[selector];
    }

    function buildOverlay(options) {
        overlay = getByID('baguetteBox-overlay');
        // Check if the overlay already exists
        if (overlay) {
            slider = getByID('baguetteBox-slider');
            previousButton = getByID('previous-button');
            nextButton = getByID('next-button');
            closeButton = getByID('close-button');
            return;
        }
        // Create overlay element
        overlay = create('div');
        overlay.setAttribute('role', 'dialog');
        overlay.id = 'baguetteBox-overlay';
        document.getElementsByTagName('body')[0].appendChild(overlay);
        // Create gallery slider element
        slider = create('div');
        slider.id = 'baguetteBox-slider';
        overlay.appendChild(slider);
        // Create all necessary buttons
        previousButton = create('button');
        previousButton.setAttribute('type', 'button');
        previousButton.id = 'previous-button';
        previousButton.setAttribute('aria-label', 'Previous');
        previousButton.innerHTML = supports.svg ? leftArrow : '&lt;';
        overlay.appendChild(previousButton);

        nextButton = create('button');
        nextButton.setAttribute('type', 'button');
        nextButton.id = 'next-button';
        nextButton.setAttribute('aria-label', 'Next');
        nextButton.innerHTML = supports.svg ? rightArrow : '&gt;';
        overlay.appendChild(nextButton);

        closeButton = create('button');
        closeButton.setAttribute('type', 'button');
        closeButton.id = 'close-button';
        closeButton.setAttribute('aria-label', 'Close');
        closeButton.innerHTML = supports.svg ? closeX : '&times;';
        overlay.appendChild(closeButton);

        previousButton.className = nextButton.className = closeButton.className = 'baguetteBox-button';

        bindEvents(options);
    }

    function keyDownHandler(event) {
        switch (event.keyCode) {
            case 37: // Left arrow
                showPreviousImage();
                break;
            case 39: // Right arrow
                showNextImage();
                break;
            case 27: // Esc
                hideOverlay();
                break;
            case 36: // Home
                showFirstImage(event);
                break;
            case 35: // End
                showLastImage(event);
                break;
        }
    }

    function bindEvents() {
        var nonPassiveEvent = supports.passiveEvents ? { passive: true } : null;

        bind(overlay, 'click', overlayClickHandler);
        bind(previousButton, 'click', previousButtonClickHandler);
        bind(nextButton, 'click', nextButtonClickHandler);
        bind(closeButton, 'click', closeButtonClickHandler);
        bind(overlay, 'touchstart', touchstartHandler, nonPassiveEvent);
        bind(overlay, 'touchend', touchendHandler);
        bind(document, 'focus', trapFocusInsideOverlay, true);
    }

    function unbindEvents() {
        var nonPassiveEvent = supports.passiveEvents ? { passive: true } : null;

        unbind(overlay, 'click', overlayClickHandler);
        unbind(previousButton, 'click', previousButtonClickHandler);
        unbind(nextButton, 'click', nextButtonClickHandler);
        unbind(closeButton, 'click', closeButtonClickHandler);
        unbind(overlay, 'touchstart', touchstartHandler, nonPassiveEvent);
        unbind(overlay, 'touchend', touchendHandler);
        unbind(document, 'focus', trapFocusInsideOverlay, true);
    }

    function prepareOverlay(gallery, userOptions) {
        // If the same gallery is being opened prevent from loading it once again
        if (currentGallery === gallery) {
            return;
        }
        currentGallery = gallery;
        // Update gallery specific options
        setOptions(userOptions);
        // Empty slider of previous contents (more effective than .innerHTML = "")
        while (slider.firstChild) {
            slider.removeChild(slider.firstChild);
        }
        imagesElements.length = 0;

        var imagesFiguresIds = [];
        var imagesCaptionsIds = [];
        // Prepare and append images containers and populate figure and captions IDs arrays
        if (userOptions.initialImageURIList && userOptions.initialImageURIList.length > 0) {
            let lengthhh = userOptions.initialImageURIList.length;
            for (var i = 0, fullImage; i < lengthhh; i++) {
                fullImage = create('div');
                fullImage.className = 'full-image';
                fullImage.id = 'baguette-img-' + i;
                imagesElements.push(fullImage);

                imagesFiguresIds.push('baguetteBox-figure-' + i);
                imagesCaptionsIds.push('baguetteBox-figcaption-' + i);
                slider.appendChild(imagesElements[i]);
            }
        } else {
            for (var i = 0, fullImage; i < gallery.length; i++) {
                fullImage = create('div');
                fullImage.className = 'full-image';
                fullImage.id = 'baguette-img-' + i;
                imagesElements.push(fullImage);

                imagesFiguresIds.push('baguetteBox-figure-' + i);
                imagesCaptionsIds.push('baguetteBox-figcaption-' + i);
                slider.appendChild(imagesElements[i]);
            }
        }
        overlay.setAttribute('aria-labelledby', imagesFiguresIds.join(' '));
        overlay.setAttribute('aria-describedby', imagesCaptionsIds.join(' '));
    }

    function setOptions(newOptions) {
        if (!newOptions) {
            newOptions = {};
        }
        // Fill options object
        for (var item in defaults) {
            options[item] = defaults[item];
            if (typeof newOptions[item] !== 'undefined') {
                options[item] = newOptions[item];
            }
        }
        /* Apply new options */
        // Change transition for proper animation
        slider.style.transition = slider.style.webkitTransition = (options.animation === 'fadeIn' ? 'opacity .4s ease' :
            options.animation === 'slideIn' ? '' : 'none');
        // Hide buttons if necessary
        if (options.buttons === 'auto' && ('ontouchstart' in window || currentGallery.length === 1)) {
            options.buttons = false;
        }
        // Set buttons style to hide or display them
        previousButton.style.display = nextButton.style.display = (options.buttons ? '' : 'none');
        // Set overlay color
        try {
            overlay.style.backgroundColor = options.overlayBackgroundColor;
        } catch (e) {
            // Silence the error and continue
        }
    }

    function toggleFullScreenBehavior() {
        options.fullScreen = !options.fullScreen;
        // full screen never show context menu
        if (options.fullScreen)
            $('.bagueteeBox-context-menu').addClass('d-none')
        else
            $('.bagueteeBox-context-menu').removeClass('d-none')
        return options.fullScreen;
    }

    function showOverlay(chosenImageIndex) {
        location.hash = '#baguette';
        if (options.noScrollbars) {
            document.documentElement.style.overflowY = 'hidden';
            document.body.style.overflowY = 'scroll';
        }
        if (overlay.style.display === 'block') {
            return;
        }

        bind(document, 'keydown', keyDownHandler);
        currentIndex = chosenImageIndex;
        touch = {
            startX: null,
            startY: null
        };
        loadImage(currentIndex, function () {
            preloadNext(currentIndex);
            preloadPrev(currentIndex);
        });

        updateOffset();
        overlay.style.display = 'block';
        if (options.fullScreen) {
            enterFullScreen();
        }
        // Fade in overlay
        setTimeout(function () {
            overlay.className = 'visible';
            if (options.bodyClass && document.body.classList) {
                document.body.classList.add(options.bodyClass);
            }
            if (options.afterShow) {
                options.afterShow();
            }
        }, 50);
        if (options.onChange) {
            options.onChange(currentIndex, imagesElements.length);
        }
        documentLastFocus = document.activeElement;
        initFocus();
        isOverlayVisible = true;
        if (options.customContextMenuEnabled && !options.fullScreen) {
            loadContextMenu();
        }
    }

    function initFocus() {
        if (options.buttons) {
            previousButton.focus();
        } else {
            closeButton.focus();
        }
    }

    function enterFullScreen() {
        if (overlay.requestFullscreen) {
            overlay.requestFullscreen();
        } else if (overlay.webkitRequestFullscreen) {
            overlay.webkitRequestFullscreen();
        } else if (overlay.mozRequestFullScreen) {
            overlay.mozRequestFullScreen();
        }
    }

    function exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }

    function hideOverlay() {
        pauseAnyVideoPlaying();
        if (options.noScrollbars) {
            document.documentElement.style.overflowY = 'auto';
            document.body.style.overflowY = 'auto';
        }
        if (overlay.style.display === 'none') {
            return;
        }

        unbind(document, 'keydown', keyDownHandler);
        // Fade out and hide the overlay
        overlay.className = '';
        setTimeout(function () {
            overlay.style.display = 'none';
            if (document.fullscreen) {
                exitFullscreen();
            }
            if (options.bodyClass && document.body.classList) {
                document.body.classList.remove(options.bodyClass);
            }
            if (options.afterHide) {
                options.afterHide();
            }
            documentLastFocus && documentLastFocus.focus();
            isOverlayVisible = false;
            if (options.scalable)
                clearState();
        }, 500);
    }

    function pauseAnyVideoPlaying() {
        [].forEach.call(imagesElements, function (imageElement) {
            if (imageElement.getElementsByTagName('video').length > 0) {
                imageElement.getElementsByTagName('video')[0].pause();
            }
        });
    }

    function loadImage(index, callback) {
        var imageContainer = imagesElements[index];
        var galleryItem = currentGallery[index];
        if (galleryItem) {
            var isVideo = false;
            if (typeof imageContainer !== 'undefined') {
                isVideo = videoRegex.test(galleryItem.imageElement.href);
            }
            // Return if the index exceeds prepared images in the overlay
            // or if the current gallery has been changed / closed
            if (typeof imageContainer === 'undefined' || typeof galleryItem === 'undefined') {
                return;
            }

            // If image is already loaded run callback and return OR If video is already loaded run callback and return
            if (imageContainer.getElementsByTagName('img').length > 0 || imageContainer.getElementsByTagName('video').length > 0) {
                if (callback) {
                    callback();
                }
                return;
            }

            // Get element reference, optional caption and source path
            var imageElement = galleryItem.imageElement;
            var thumbnailElement = imageElement.getElementsByTagName('img')[0];
            var imageCaption = typeof options.captions === 'function' ?
                options.captions.call(currentGallery, imageElement) :
                imageElement.getAttribute('data-caption') || imageElement.title;
            var imageSrc = getImageSrc(imageElement);

            // Prepare figure element
            var figure = create('figure');
            figure.id = 'baguetteBox-figure-' + index;
            figure.innerHTML = '<div class="baguetteBox-spinner">' +
                '<div class="baguetteBox-double-bounce1"></div>' +
                '<div class="baguetteBox-double-bounce2"></div>' +
                '</div>';
            // Insert caption if available
            if (options.captions && imageCaption) {
                var figcaption = create('figcaption');
                figcaption.id = 'baguetteBox-figcaption-' + index;
                figcaption.innerHTML = imageCaption;
                figure.appendChild(figcaption);
            }
            imageContainer.appendChild(figure);

            if (isVideo) {
                // Prepare gallery video element
                var video = create('video');
                //video.onload = function() {
                video.addEventListener('loadeddata', function () {
                    //Remove loader element
                    var spinner = document.querySelector('#baguette-img-' + index + ' .baguetteBox-spinner');
                    figure.removeChild(spinner);
                    if (!options.async && callback) {
                        callback();
                    }
                });
                var source = create('source');
                source.setAttribute('src', imageSrc);
                video.setAttribute('loop', 'loop');
                video.appendChild(source);
                if (options.titleTag && imageCaption) {
                    video.title = imageCaption;
                }
                figure.appendChild(video);
            } else {
                // Prepare gallery img element
                var image = create('img');
                image.onload = function () {
                    // Remove loader element
                    var spinner = document.querySelector('#baguette-img-' + index + ' .baguetteBox-spinner');
                    figure.removeChild(spinner);
                    if (!options.async && callback) {
                        callback();
                    }
                };
                image.setAttribute('src', imageSrc);
                image.alt = thumbnailElement ? thumbnailElement.alt || '' : '';
                if (options.titleTag && imageCaption) {
                    image.title = imageCaption;
                }
                figure.appendChild(image);
            }

            // Run callback
            if (options.async && callback) {
                callback();
            }
            if (options.scalable) {
                $('.full-image').draggable({
                    addClasses: false
                });
            }
        } else {
            var isVideo = false;
            if (typeof imageContainer !== 'undefined') {
                isVideo = videoRegex.test(paper_userOptions.initialImageURIList[index]);
            } else {
                return;
            }
            // If image is already loaded run callback and return OR If video is already loaded run callback and return
            if (imageContainer.getElementsByTagName('img').length > 0 || imageContainer.getElementsByTagName('video').length > 0) {
                if (callback) {
                    callback();
                }
                return;
            }

            // Get element reference, optional caption and source path
            // var imageElement = galleryItem.imageElement;
            // var thumbnailElement = imageElement.getElementsByTagName('img')[0];
            // var imageCaption = typeof options.captions === 'function' ?
            //     options.captions.call(currentGallery, imageElement) :
            //     imageElement.getAttribute('data-caption') || imageElement.title;
            var imageSrc = paper_userOptions.initialImageURIList[index];

            // Prepare figure element
            var figure = create('figure');
            figure.id = 'baguetteBox-figure-' + index;
            figure.innerHTML = '<div class="baguetteBox-spinner">' +
                '<div class="baguetteBox-double-bounce1"></div>' +
                '<div class="baguetteBox-double-bounce2"></div>' +
                '</div>';
            imageContainer.appendChild(figure);

            if (isVideo) {
                // Prepare gallery video element
                var video = create('video');
                //video.onload = function() {
                video.addEventListener('loadeddata', function () {
                    //Remove loader element
                    var spinner = document.querySelector('#baguette-img-' + index + ' .baguetteBox-spinner');
                    figure.removeChild(spinner);
                    if (!options.async && callback) {
                        callback();
                    }
                });
                var source = create('source');
                source.setAttribute('src', imageSrc);
                video.setAttribute('loop', 'loop');
                video.appendChild(source);
                if (options.titleTag && imageCaption) {
                    video.title = imageCaption;
                }
                figure.appendChild(video);
            } else {
                // Prepare gallery img element
                var image = create('img');
                image.onload = function () {
                    // Remove loader element
                    var spinner = document.querySelector('#baguette-img-' + index + ' .baguetteBox-spinner');
                    figure.removeChild(spinner);
                    if (!options.async && callback) {
                        callback();
                    }
                };
                image.setAttribute('src', imageSrc);
                if (options.titleTag && imageCaption) {
                    image.title = imageCaption;
                }
                figure.appendChild(image);
            }

            // Run callback
            if (options.async && callback) {
                callback();
            }
            if (options.scalable) {
                $('.full-image').draggable({
                    addClasses: false
                });
            }
        }
    }

    // Get image source location, mostly used for responsive images
    function getImageSrc(image) {
        // Set default image path from href
        var result;
        if (options.dblTrigger)
            result = image.getAttribute('dblHref');
        else
            result = image.href;
        // If dataset is supported find the most suitable image
        if (image.dataset) {
            var srcs = [];
            // Get all possible image versions depending on the resolution
            for (var item in image.dataset) {
                if (item.substring(0, 3) === 'at-' && !isNaN(item.substring(3))) {
                    srcs[item.replace('at-', '')] = image.dataset[item];
                }
            }
            // Sort resolutions ascending
            var keys = Object.keys(srcs).sort(function (a, b) {
                return parseInt(a, 10) < parseInt(b, 10) ? -1 : 1;
            });
            // Get real screen resolution
            var width = window.innerWidth * window.devicePixelRatio;
            // Find the first image bigger than or equal to the current width
            var i = 0;
            while (i < keys.length - 1 && keys[i] < width) {
                i++;
            }
            result = srcs[keys[i]] || result;
        }
        return result;
    }

    // clear scale and drag state
    function clearState() {
        let items = document.querySelectorAll('.full-image');
        for (let item of items) {
            item.style = '';
            if (item.querySelector('figure') == null)
                continue;
            let deeper = item.querySelector('img');
            if (deeper == null)
                deeper = item.querySelector('video');
            deeper.classList.remove('scale');
        }
        scaleRate = 1;
    }

    // Return false at the right end of the gallery
    function showNextImage() {
        if (options.scalable)
            clearState();
        return show(currentIndex + 1);
    }

    // Return false at the left end of the gallery
    function showPreviousImage() {
        if (options.scalable)
            clearState();
        return show(currentIndex - 1);
    }

    // Return false at the left end of the gallery
    function showFirstImage(event) {
        if (event) {
            event.preventDefault();
        }
        return show(0);
    }

    // Return false at the right end of the gallery
    function showLastImage(event) {
        if (event) {
            event.preventDefault();
        }
        return show(currentGallery.length - 1);
    }

    /**
     * Move the gallery to a specific index
     * @param `index` {number} - the position of the image
     * @param `gallery` {array} - gallery which should be opened, if omitted assumes the currently opened one
     * @return {boolean} - true on success or false if the index is invalid
     */
    function show(index, gallery) {
        if (!isOverlayVisible && index >= 0 && index < gallery.length) {
            prepareOverlay(gallery, options);
            showOverlay(index);
            return true;
        }
        if (index < 0) {
            if (options.animation) {
                bounceAnimation('left');
            }
            return false;
        }
        if (index >= imagesElements.length) {
            if (options.animation) {
                bounceAnimation('right');
            }
            return false;
        }

        currentIndex = index;
        loadImage(currentIndex, function () {
            preloadNext(currentIndex);
            preloadPrev(currentIndex);
        });
        updateOffset();

        if (options.onChange) {
            options.onChange(currentIndex, imagesElements.length);
        }

        return true;
    }

    /**
     * identify if next image is exists
     */
    function hasNextImage() {
        return currentIndex < currentGallery.length - 1;
    }

    /**
     * identify if previous image is exists
     */
    function hasPreviousImage() {
        return currentIndex > 0;
    }

    /**
     * Triggers the bounce animation
     * @param {('left'|'right')} direction - Direction of the movement
     */
    function bounceAnimation(direction) {
        slider.className = 'bounce-from-' + direction;
        setTimeout(function () {
            slider.className = '';
        }, 400);
    }

    function updateOffset() {
        pauseAnyVideoPlaying();
        var offset = -currentIndex * 100 + '%';
        if (options.animation === 'fadeIn') {
            slider.style.opacity = 0;
            setTimeout(function () {
                supports.transforms ?
                    slider.style.transform = slider.style.webkitTransform = 'translate3d(' + offset + ',0,0)'
                    : slider.style.left = offset;
                slider.style.opacity = 1;
            }, 400);
        } else {
            supports.transforms ?
                slider.style.transform = slider.style.webkitTransform = 'translate3d(' + offset + ',0,0)'
                : slider.style.left = offset;
        }
        if (imagesElements[currentIndex].getElementsByTagName('video').length > 0) {
            imagesElements[currentIndex].getElementsByTagName('video')[0].play();
        }
    }

    // CSS 3D Transforms test
    function testTransformsSupport() {
        var div = create('div');
        return typeof div.style.perspective !== 'undefined' || typeof div.style.webkitPerspective !== 'undefined';
    }

    // Inline SVG test
    function testSvgSupport() {
        var div = create('div');
        div.innerHTML = '<svg/>';
        return (div.firstChild && div.firstChild.namespaceURI) === 'http://www.w3.org/2000/svg';
    }

    // Borrowed from https://github.com/seiyria/bootstrap-slider/pull/680/files
    /* eslint-disable getter-return */
    function testPassiveEventsSupport() {
        var passiveEvents = false;
        try {
            var opts = Object.defineProperty({}, 'passive', {
                get: function () {
                    passiveEvents = true;
                }
            });
            window.addEventListener('test', null, opts);
        } catch (e) { /* Silence the error and continue */ }

        return passiveEvents;
    }

    /* eslint-enable getter-return */

    function preloadNext(index) {
        if (index - currentIndex >= options.preload) {
            return;
        }
        loadImage(index + 1, function () {
            preloadNext(index + 1);
        });
    }

    function preloadPrev(index) {
        if (currentIndex - index >= options.preload) {
            return;
        }
        loadImage(index - 1, function () {
            preloadPrev(index - 1);
        });
    }

    function bind(element, event, callback, options) {
        if (element.addEventListener) {
            element.addEventListener(event, callback, options);
        } else {
            // IE8 fallback
            element.attachEvent('on' + event, function (event) {
                // `event` and `event.target` are not provided in IE8
                event = event || window.event;
                event.target = event.target || event.srcElement;
                callback(event);
            });
        }
    }

    /**  
     * Bind when double click option is enabled.
     * This is like a debounce function though.
     */
    function bindSingleDoubleClickItems(element, callbackForDoubleClick, options) {
        if (options.dblTrigger) {
            let timeout, click = 0;
            element.addEventListener('click', function (event) {
                click++;
                clearTimeout(timeout);
                timeout = setTimeout(function () {
                    if (click === 1) // what shall do when double clicking enabled and user single clicked the images
                        options.singleClickCallBack(event);
                    if (click >= 2) // show overlay when user double clicked(or more than double clicking, so it is even able to differentiate triple clicking and more...)
                        callbackForDoubleClick(event);
                    click = 0;
                }, options.doubleClickJudgeTimeout) // here defines a timeout gap judging if it is a single click or double click, metered by milliseconds
            }, options)
        } else { // might never be executed, still leave it here as an alternative of bind method
            bind(element, 'click', callbackForDoubleClick, options); // what shall do when double clicking disabled and user single clicked the images
        }
    }

    function unbind(element, event, callback, options) {
        if (element.removeEventListener) {
            element.removeEventListener(event, callback, options);
        } else {
            // IE8 fallback
            element.detachEvent('on' + event, callback);
        }
    }

    function getByID(id) {
        return document.getElementById(id);
    }

    function create(element) {
        return document.createElement(element);
    }

    function destroyPlugin() {
        unbindEvents();
        clearCachedData();
        unbind(document, 'keydown', keyDownHandler);
        document.getElementsByTagName('body')[0].removeChild(document.getElementById('baguetteBox-overlay'));
        data = {};
        currentGallery = [];
        currentIndex = 0;
    }

    let loadContextMenu = (() => {
        let time = 0; // make sure only one instance of context menu generated (context menu doc api destroy is not working....)
        return () => {
            if (time === 1)
                return;
            else
                time++;
            $('#baguetteBox-slider').contextMenu({
                selector: '.full-image',
                className: 'bagueteeBox-context-menu',
                build: function () {
                    this.items.at.name = `${currentIndex + 1} / ${(paper_userOptions.initialImageURIList && paper_userOptions.initialImageURIList.length) > 0 ? paper_userOptions.initialImageURIList.length : currentGallery.length}`;
                },
                callback: function (key) {
                    if (key === 'download') {
                        window.location.assign($('#baguetteBox-slider .full-image').eq(currentIndex).find('img').attr('src'));
                    }
                    else if (key === 'prev')
                        showPreviousImage();
                    else if (key === 'next')
                        showNextImage();
                    else if (key === 'exit')
                        hideOverlay();
                    else if (key === 'f5' || key === 'f20' || key === 'f50') {
                        let step = +key.substring(1);
                        show(currentIndex === currentGallery.length - 1 ? currentGallery.length : ((currentIndex + step) >= currentGallery.length ? (currentGallery.length - 1) : currentIndex + step));
                        clearState();
                    }
                    else if (key === 'b5' || key === 'b20' || key === 'b50') {
                        let step = +key.substring(1);
                        show(currentIndex === 0 ? -1 : ((currentIndex - step) < 0 ? 0 : (currentIndex - step)));
                        clearState();
                    }
                    else if (key === 'fend') {
                        show(currentGallery.length - 1);
                        clearState();
                    }
                    else if (key === 'fstart') {
                        show(0);
                        clearState();
                    }
                },
                items: {
                    "at": { name: "", disabled: true },
                    "scale": {
                        name: "Set Scale Rate", icon: " i-arrows-angle-expand",
                        items: {
                            "s2": { name: "2.0 (default)", icon: " i-cloud" },
                            "s25": { name: "2.5", icon: " i-cloud-drizzle" },
                            "s3": { name: "3.0", icon: " i-cloud-rain-heavy" }
                        }
                    },
                    "skip": {
                        name: "Skip Images", icon: " i-arrow-up-right",
                        items: {
                            "f5": { name: "5 Forward", icon: " i-chevron-compact-right" },
                            "f20": { name: "20 Forward", icon: " i-chevron-right" },
                            "f50": { name: "50 Forward", icon: " i-chevron-double-right" },
                            "fend": { name: "Last One", icon: " i-chevron-bar-right" },
                            "sep": "-",
                            "b5": { name: "5 Backward", icon: " i-chevron-compact-left" },
                            "b20": { name: "20 Backward", icon: " i-chevron-left" },
                            "b50": { name: "50 Backward", icon: " i-chevron-double-left" },
                            "fstart": { name: "First One", icon: " i-chevron-bar-left" },
                        }
                    },
                    "download": { name: "Save As....", icon: " i-download" },
                    "prev": { name: "Previous Image", icon: " i-box-arrow-left", visible: hasPreviousImage },
                    "next": { name: "Next Image", icon: " i-box-arrow-right", visible: hasNextImage },
                    "exit": { name: "Exit Preview", icon: " i-arrow-return-left" }
                }
            })
        }
    })();

    return {
        run: run,
        show: show,
        showNext: showNextImage,
        showPrevious: showPreviousImage,
        hide: hideOverlay,
        destroy: destroyPlugin,
        toggleFullScreenBehavior: toggleFullScreenBehavior,
        addMore,
        // getScaleRate: getScaleRate
    };
}));
