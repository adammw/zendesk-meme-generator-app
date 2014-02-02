(function() {
  var API_BASE = 'http://version1.api.memegenerator.net/';

  var $ = this.$;

  var itemsCache = {};

  return {
    requests: {
      'binary': function(url) {
        return {
          url: url,
          dataType:'text',
          beforeSend:function(xhr){
            xhr.overrideMimeType('text/plain; charset=x-user-defined')
          },
          proxy_v2: true
        }
      },
      'Upload_Attachment': function(attachment, filename) {
        return {
          url: '/api/v2/uploads.json?filename=' + filename,
          type: 'POST',
          contentType: false,
          processData: false,
          data: attachment,
          dataType: 'json'
        }
      },
      'Add_Ticket_Comment': function(ticketId, comment) {
        return {
          url: '/api/v2/tickets/' + ticketId + '.json',
          type: 'PUT',
          contentType: 'application/json',
          data: JSON.stringify({
            ticket: {
              comment: comment
            }
          }),
          dataType: 'json'
        }
      },
      'Generators_Search': function(data) {
        return {
          url: API_BASE + 'Generators_Search',
          data: data,
          proxy_v2: true
        }
      },
      'Instance_Select': function(instanceID) {
        return {
          url: API_BASE + 'Instance_Select',
          data: {
            instanceID: instanceID
          },
          proxy_v2: true
        }
      },
      'Instances_Select_ByTopic': function(query, pageIndex, pageSize) {
        return {
          url: API_BASE + 'Instances_Select_ByTopic',
          data: {
            word: query,
            pageIndex: pageIndex || 0,
            pageSize: pageSize || 12,
            languageCode: 'en' // TODO (adammw): i18n
          },
          proxy_v2: true
        }
      },
      'Instances_Select_ByNew': function(pageIndex, pageSize) {
        return {
          url: API_BASE + 'Instances_Select_ByNew',
          data: {
            pageIndex: pageIndex || 0,
            pageSize: pageSize || 12,
            languageCode: 'en' // TODO (adammw): i18n
          },
          proxy_v2: true
        }
      },
      'Instances_Select_ByPopular': function(pageIndex, pageSize, days) {
        return {
          url: API_BASE + 'Instances_Select_ByPopular',
          data: {
            days: days || null,
            pageIndex: pageIndex || 0,
            pageSize: pageSize || 12,
            languageCode: 'en' // TODO (adammw): i18n
          },
          proxy_v2: true
        }
      },
      'Instance_Create': function(generatorID, imageID, text0, text1) {
        return {
          url: API_BASE + 'Instance_Create',
          data: {
            username: this.setting("username"),
            password: this.setting("password"),
            generatorID: generatorID,
            imageID: imageID,
            text0: text0,
            text1: text1,
            languageCode: 'en' // TODO (adammw): i18n
          },
          proxy_v2: true
        }
      }
    },
    events: {
      'app.activated': function() {
        var lastTab = this.store('lastTab'), $lastTab = $('.tab-content #'+lastTab + '.tab-pane');
        if ($lastTab.length) {
          $('.nav-tabs li').removeClass('active');
          $('.tab-content .tab-pane.active').removeClass('active');
          $lastTab.addClass('active');
          $('.nav-tabs li a[href="#' + lastTab + '"]').parent('li').addClass('active');
        }
        this.trigger([$('.tab-content .tab-pane.active').attr('id'),'activated'].join('.'), $('.tab-content .tab-pane.active'));
      },
      'favourites.activated': function($tab) {
        var self = this;
        var favourites = this.store('favourites') || [];
        if (favourites.length) {
          $tab.html(this.renderTemplate('loading'));
          var promises = favourites.map(function(instanceID) {
            if (!(instanceID in itemsCache)) return self.ajax('Instance_Select', instanceID);
            var promise = $.Deferred();
            setTimeout(function() {
              promise.resolve([{success: true, result: itemsCache[instanceID]}, "success", null]);
            }, 0);
            return promise;
          });
          this.when.apply(this, promises).done(function() {
            var success = true;
            favourites = Array.prototype.map.call(arguments, function(array) {
              var data = array[0];
              if (!data.success) success = false;
              return data.result;
            });
            self.renderItemList($tab, false, {
              success: success,
              result: favourites
            });
          }).fail('request.fail');
        } else {
          $tab.text(this.I18n.t('favourites.none'));
        }
      },
      'recent.activated': function($tab) {
        if ($tab.hasClass('loading') || $tab.hasClass('loaded')) return;
        $tab.addClass('loading');
        $tab.attr('data-last-page-loaded', 0);
        this.ajax('Instances_Select_ByNew').done(this.renderItemList.bind(this, $tab, false));
      },
      'popular.activated': function($tab) {
        if ($tab.hasClass('loading') || $tab.hasClass('loaded')) return;
        $tab.addClass('loading');
        $tab.attr('data-last-page-loaded', 0);
        this.ajax('Instances_Select_ByPopular').done(this.renderItemList.bind(this, $tab, false));
      },
      'create.activated': function onCreateActivated($tab) {
        var self = this;

        // poll for select2 load
        if (!$.prototype.select2) return setTimeout(onCreateActivated.bind(this, $tab), 500);
        
        var $input = $tab.find('input#generator');
        $input.select2({
          placeholder: "Search for a Generator",
          minimumInputLength: 1,
          ajax: {
            transport: function(opts) {
              self.ajax('Generators_Search', opts.data).done(opts.success);
            },
            proxy_v2: true,
            dataType: 'json',
            quietMillis: 100,
            data: function(term, page) {
              return {
                q: term.split(' ')[0], 
                pageIndex: page,
                pageSize: 12
              };
            }, 
            results: function(data, page) {
              var more = (data.result.length == 12);
              return { results: data.result, more: more };
            }
          },
          id: function(generator) {
            return generator.generatorID;
          },
          escapeMarkup: function (m) { return m; },
          formatResult: function(generator) {
            generator.imageUrl = generator.imageUrl.replace(/\/[0-9]*x[0-9]*\//, '/100x/');
            return self.renderTemplate('generator_result', generator);
          },
          formatSelection: function(generator) {
            return generator.displayName;
          }
        });
        $input.on('change', function(e) {
          var generator = e.added;
          if (!generator) return $('#create #after-selection').addClass('hidden');
          $('#selected_generator').attr('src', generator.imageUrl.replace(/\/[0-9]*x[0-9]*\//, '/320x/')).attr('data-generator-id', generator.generatorID).attr('data-image-id', /\/([0-9]+)(?:\..+)?$/.exec(generator.imageUrl)[1]);
          $('#create #after-selection').removeClass('hidden');
        });
      },
      'click .load-more': function(e) {
        e.preventDefault();
        var $tab = $('.tab-pane.active');
        var lastPageLoaded = parseInt($tab.attr('data-last-page-loaded'));
        if ($tab.hasClass('loading')) return;
        $tab.find('.load-more').addClass('hidden').before($(this.renderTemplate('loading')).wrap('<div class="loading"></div>').parent());
        $tab.addClass('loading');
        var id = $tab.attr('id');
        if (id == 'recent') {
          this.ajax('Instances_Select_ByNew', lastPageLoaded + 1).done(this.renderItemList.bind(this, $tab, true));
        } else if (id == 'popular') {
          this.ajax('Instances_Select_ByPopular', lastPageLoaded + 1).done(this.renderItemList.bind(this, $tab, true));
        } else if (id == 'search') {
          this.ajax('Instances_Select_ByTopic', $('#search input').val(), lastPageLoaded + 1).done(this.renderItemList.bind(this, $('#search .results'), true));
        }
        $tab.attr('data-last-page-loaded', lastPageLoaded + 1);
      },
      'click a#back': function(e) {
        e.preventDefault();
        $('.nav-tabs li.active a').click();
      },
      'click a#favourite': function(e) {
        e.preventDefault();
        var idx;
        var instanceID = $('#selection').attr('data-instance-id');
        var favourites = this.store('favourites') || [];
        if (-1 === (idx = favourites.indexOf(instanceID))) {
          favourites.push(instanceID);
          $('a#favourite i').removeClass('fa-star-o').addClass('fa-star');
        } else {
          favourites.splice(idx, 1);
          $('a#favourite i').removeClass('fa-star').addClass('fa-star-o');
        }
        this.store('favourites', favourites);
      },
      'click .thumb a': function(e) {
        e.preventDefault();
        $('.tab-content .tab-pane').removeClass('active');
        var instanceID = $(e.target).parent('a[data-instance-id]').attr('data-instance-id');
        var item = itemsCache[instanceID];
        item.instanceImageUrl = item.instanceImageUrl.replace('/100x100/', '/320x/');
        var favourites = this.store('favourites') || [];
        item.isFavourite = (-1 !== favourites.indexOf(instanceID));
        var $tab = $('.tab-content #selection.tab-pane');
        $tab.attr('data-instance-id', item.instanceID);
        $tab.html(this.renderTemplate('selection', item));
        $tab.addClass('active');
      },
      'click .nav-tabs [data-toggle="tab"]': function(e) {
        var href = $(e.target).attr('href');

        if (!href || '#' != href[0] || -1 !== href.indexOf(' ')) return;

        e.preventDefault();

        $('.nav-tabs li').removeClass('active');
        $(e.target).parent('li').addClass('active');

        $('.tab-content .tab-pane').removeClass('active');
        var $tab = $('.tab-content ' + href + '.tab-pane');
        $tab.addClass('active');
        this.trigger([$tab.attr('id'),'activated'].join('.'), $tab);
        this.store('lastTab', $tab.attr('id'));
      },
      'click #attach': function() {
        var id = $('#selection').attr('data-instance-id');
        var item = itemsCache[id];
        var filename = 'memegen_' + item.urlName.replace(/-/g,'_') + '_' + id + '.jpg';
        var url = item.instanceImageUrl.replace(/\/[0-9]*x[0-9]*\//, '/400x/');
        var self = this;
        $('#attach').attr('disabled', true);
        $('#attach').text('Downloading image...');
        this.ajax('binary', url).done(function(binStr) {
          var buf = new ArrayBuffer(binStr.length);
          var view = new Uint8Array(buf);
          for(var i = 0; i < view.length; i++)
            view[i] = binStr.charCodeAt(i);
          var blob = new Blob([view], {type: 'image/jpeg'});
          var fd = new FormData();
          fd.append('uploaded_data', blob, filename);
          $('#attach').text('Uploading image...');
          self.ajax('Upload_Attachment', fd, filename).done(function(data) {
            console.log('upload done', data);
            $('#attach').text('Adding comment to ticket...');
            self.ajax('Add_Ticket_Comment', self.ticket().id(), {
              public: false,
              body: ['"' + item.displayName + '" Meme', item.text0, item.text1, item.instanceUrl, (new Array(20)).join('-'), "Uploaded by Meme Generator App for Zendesk"].join('\n'),
              uploads: [data.upload.token]
            }).done(function(data) {
              console.log('comment done', data);
              $('#attach').text('Attached to ticket');
            })
          });
        });
      },
      'click #create': function(e) {
        e.preventDefault();
        var generatorID = $('#selected_generator').attr('data-generator-id');
        var imageID = $('#selected_generator').attr('data-image-id');
        this.ajax('Instance_Create', generatorID, imageID, $('#text0').val(), $('#text1').val() ).done(function() {
          console.log('Instance_Create done,', arguments);
        });
      },
      'submit #search form': function(e) {
        e.preventDefault();
        $('.tab-pane.active').attr('data-last-page-loaded', 0);
        this.ajax('Instances_Select_ByTopic', $('#search input').val()).done(this.renderItemList.bind(this, $('#search .results'), false));
      },
      'Instances_Select_ByNew.fail': 'request.fail',
      'Instances_Select_ByPopular.fail': 'request.fail',
      'request.fail': function() {
        $('.tab-content .tab-pane').removeClass('active').removeClass('loading');
        $('.tab-content #failure.tab-pane').addClass('active');
      }
    },
    renderItemList: function($tab, append, data) {
      if (!data.success) return this.trigger('request.fail');
      var html = (data.result.length) ? this.renderTemplate('list', {
        favouritePage: $tab.attr('id') == 'favourites',
        items: data.result.map(function(item) {
          itemsCache[item.instanceID] = item;
          item.instanceImageUrl = item.instanceImageUrl.replace('/400x/', '/100x100/');
          return item;
        })
      }) : this.I18n.t('no_results');
      if (true === append) {
        $tab.find('.load-more').remove();
        $tab.find('.loading').remove();
        $tab.append(html);
      } else {
        $tab.html(html);
      }
      $tab.removeClass('loading').addClass('loaded');
      if (!data.result.length) return;
      $tab.find('.load-more').removeClass('hidden');
    }
  };
})();