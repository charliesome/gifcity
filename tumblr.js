( function ( window ) {
  var $ = function ( selector, context ) {
    return ( context || document ).querySelector( selector );
  },

  Tumblr = {
    // toolmantim/gifcity Tumblr app
    apiKey: 'DjfvFbmCVQB3yHER0TMUB2ndguw5wqeNDv7ywyMipM9ZQpEtYn',
    changeImageDelay: 10000,
    requestDelay: 5000,
    offsetIncrement: 20,
    imageHolder: $( '#image-holder' ),
    requestCallbacks: {},

    url: function ( blog ) {
      return 'https://api.tumblr.com/v2' +
             '/blog/' + blog.name + '.tumblr.com/posts?' +
             'api_key=' + Tumblr.apiKey +
             '&offset=' + blog.offset +
             ( blog.tag.length ? '&tag=' + blog.tag : '' ) +
             '&callback=Tumblr.response';
    },

    init: function ( names ) {
      Tumblr.blogs = Tumblr.initBlogs( names );

      Tumblr.changeImage();
      Tumblr.initKeyboard();
      Tumblr.refreshBlogs();
    },

    initKeyboard: function () {
      key( 'x', function () {
        Tumblr.purgeCurrentImage();
        Tumblr.changeImage();
      } );

      key( 'n', function () {
        Tumblr.changeImage();
      } );

      key( 'f', function() {
        Tumblr.toggleFullscreen();
      });
    },

    initBlogs: function ( names ) {
      return names.map ( function ( name ) {
        var blog = Tumblr.storage.get( name );
        var segments = name.split( '#' );

        return blog || {
          name:   segments[0],
          tag:    segments[1] || '',
          offset: 0,
          gifs:   []
        };
      } );
    },

    refreshBlogs: function () {
      async.forEach( Tumblr.blogs, Tumblr.request, function ( error ) {
        setTimeout( Tumblr.refreshBlogs, Tumblr.requestDelay );
      } );
    },

    request: function ( blog, callback ) {
      Tumblr.requestCallbacks[blog.name] = [];
      Tumblr.requestCallbacks[blog.name].push( callback );

      var element = document.createElement( 'script' );
      element.setAttribute( 'src', Tumblr.url( blog ) );

      Tumblr.requestCallbacks[blog.name].push( function () {
        element.parentNode.removeChild( element );
      });

      document.documentElement.appendChild( element );
    },

    response: function ( json ) {
      if (!json.response.blog) return;

      var blog = Tumblr.blogs.find( function ( blog ) {
        return ( blog.name == json.response.blog.name );
      } );

      Tumblr.handleResponse( blog, json );

      var callbacks = Tumblr.requestCallbacks[blog.name];

      callbacks.forEach( function ( callback ) {
        callback( null, blog );
      });

      document.title = "gifcity - " + blog.name;
    },

    handleResponse: function ( blog, json ) {
      if ( json.response.posts.length > 0 ) {
        var gifs = Tumblr.getGifs( json.response.posts );

        if ( gifs.length > 0 ) {
          blog.gifs = blog.gifs.concat( gifs );

          if ( Tumblr.gifCountChangedCallback ) {
            Tumblr.gifCountChangedCallback( blog );
          }
        }

        blog.offset += Tumblr.offsetIncrement;
        Tumblr.storage.set( blog );

        if ( !Tumblr.current ) { Tumblr.changeImage(); }
      }
    },

    getGifs: function ( posts ) {
      return posts.reduce( function( photos, post ) {
        switch ( post.type ) {
          case "photo":
            return photos.concat( Tumblr.extractGifsFromPostPhotos( post.photos ) );
          case "text":
            return photos.concat( Tumblr.extractGifsFromHtml( post.body ) );
          default:
            return photos;
        }
      }, [] );
    },

    extractGifsFromPostPhotos: function ( photos ) {
      var photoUrls = photos.map( function( photo ) {
        return photo.original_size.url;
      } );
      return photoUrls.filter( function( url ) {
        return url.match( /\.gif$/ );
      } );
    },

    extractGifsFromHtml: function ( html ) {
      return html.match( /http[^"]*?\.gif/g );
    },

    changeImage: function () {
      clearTimeout ( Tumblr.changeImageTimeoutId );

      var pairs = Tumblr.blogs.reduce( function ( memo, blog ) {
        return memo.concat( blog.gifs.map( function ( gif ) {
          return {blog: blog, gif: gif};
        } ) );
      }, [] );

      Tumblr.current = pairs.rand();

      if ( Tumblr.current ) {
        var preload = new Image();

        preload.onload = function () {
          Tumblr.imageHolder.innerHTML = "" +
            "<img src='" + Tumblr.current.gif + "' class='left-image'>" +
            "<img src='" + Tumblr.current.gif + "' class='image'>" +
            "<img src='" + Tumblr.current.gif + "' class='right-image'>";
          Tumblr.changeImageTimeoutId = setTimeout( Tumblr.changeImage, Tumblr.changeImageDelay );
        };

        preload.onerror = function () {
          Tumblr.changeImageTimeoutId = setTimeout( Tumblr.changeImage, 0 );
        };

        preload.src = Tumblr.current.gif;
      }
    },

    toggleFullscreen: function() {
      if (document.fullscreenElement ||
          document.webkitFullscreenElement ||
          document.mozFullscreenElement ||
          document.msFullscreenElement) {
        if (document.cancelFullScreen) document.cancelFullScreen();
        if (document.mozCancelFullScreen) document.mozCancelFullScreen();
        if (document.webkitCancelFullScreen) document.webkitCancelFullScreen();
        if (document.msCancelFullScreen) document.msCancelFullScreen();
      } else {
        var requestFullscreen =
          Tumblr.imageHolder.requestFullScreen ||
          Tumblr.imageHolder.mozRequestFullScreen ||
          Tumblr.imageHolder.webkitRequestFullScreen ||
          Tumblr.imageHolder.msRequestFullScreen;
        if (!requestFullscreen)
          alert("Your browser doesn't support fullscreen");
        else
          requestFullscreen.call(Tumblr.imageHolder, Tumblr.imageHolder.ALLOW_KEYBOARD_INPUT);
      }
    },

    purgeCurrentImage: function () {
      if ( Tumblr.current ) {
        var gifs = Tumblr.current.blog.gifs.filter( function ( gif ) {
          return gif != Tumblr.current.gif;
        } );

        Tumblr.current.blog.gifs = gifs;
        Tumblr.storage.set( Tumblr.current.blog );
      }
    },

    storageKey: function ( blog ) {
      if ( blog.tag.length > 0 )
        return blog.name + "#" + blog.tag;
      else
        return blog.name;
    },

    listBlogs: function () {
      return Tumblr.blogs.map( function ( blog ) { return blog.name } );
    },

    addBlog: function ( name ) {
      var blogs = Tumblr.listBlogs();
      blogs.push( name );

      window.location.search = '?t=' + blogs;
    },

    removeBlog: function ( name ) {
      var blogs = Tumblr.listBlogs(),
          index = blogs.indexOf( name );
      blogs.splice( index, 1 );

      window.location.search = '?t=' + blogs;
    },

    storage: {
      get: function ( storageKey ) {
        var json = localStorage.getItem( storageKey );
        if ( json )
          return JSON.parse( json );
        else
          return null;
      },

      set: function ( blog ) {
        localStorage.setItem( Tumblr.storageKey( blog ), JSON.stringify( blog ) );
      }
    }
  },

  // General utils
  Util = {
    // Thanks http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values
    getParameterByName: function ( name ) {
      var match = RegExp( '[?&]' + name + '=([^&]*)' ).exec( window.location.search );
      return match && decodeURIComponent( match[1] );
    }
  };

  Array.prototype.rand = function () {
    if ( this.length > 0 ) {
      var index = Math.floor( this.length * Math.random() );
      return this[index];
    }
  };

  Array.prototype.find = function ( predicate ) {
    return this.filter( predicate )[0];
  };

  var t = Util.getParameterByName( 't' ) || 'ntrnts,pi-slices,dvdp,patakk,karmanistic,psychedelicgifs,beesandbombs',
      viewingListEl = $( '.viewing-list' ),
      blogTemplate = $( '#blog[type="text/template"]' ).innerHTML;

  window.Tumblr = Tumblr;
  Tumblr.init( t.split( ',' ) );

  Tumblr.gifCountChangedCallback = function ( blog ) {
    $( '.blog[data-name="' + blog.name + '"] .count' ).innerHTML = blog.gifs.length;
  }

  $( 'form' ).addEventListener( 'submit', function ( event ) {
    var newBlog = newBlog = $( 'input', event.target ).value;
    Tumblr.addBlog( newBlog )
    event.preventDefault();
  });

  // Update page elements
  Tumblr.blogs.forEach( function ( blog ) {
    var view = blogTemplate.replace( /\{\{ name \}\}/g, blog.name ).
               replace( /\{\{ count \}\}/g, blog.gifs.length );

    viewingListEl.innerHTML += view;
  });

  // Remove buttons
  $( 'html' ).addEventListener( 'click', function ( event ) {
    if ( [].forEach.call( document.querySelectorAll( '.remove' ), function ( button ) {
      if ( button === event.target ) {
        var parent = button.parentNode;
        var blogName = parent.dataset.name;
        parent.parentNode.removeChild( parent );

        Tumblr.removeBlog( blogName );
      }
    } ) );
  } );

}( window ) );
