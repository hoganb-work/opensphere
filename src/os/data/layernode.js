goog.provide('os.data.LayerNode');

goog.require('goog.events.EventType');
goog.require('ol.events');
goog.require('os.data.DataManager');
goog.require('os.data.IExtent');
goog.require('os.data.ISearchable');
goog.require('os.events.PropertyChangeEvent');
goog.require('os.filter.BaseFilterManager');
goog.require('os.filter.IFilterable');
goog.require('os.layer.LayerGroup');
goog.require('os.layer.Tile');
goog.require('os.layer.Vector');
goog.require('os.structs.TriState');
goog.require('os.ui.ILayerUIProvider');
goog.require('os.ui.layer.LayerVisibilityUI');
goog.require('os.ui.node.defaultLayerNodeUIDirective');
goog.require('os.ui.node.featureCountDirective');
goog.require('os.ui.node.layerTypeDirective');
goog.require('os.ui.node.tileLoadingDirective');
goog.require('os.ui.slick.SlickTreeNode');
goog.require('os.ui.triStateCheckboxDirective');



/**
 * Tree nodes for layers
 *
 * @extends {os.ui.slick.SlickTreeNode}
 * @implements {os.data.ISearchable}
 * @implements {os.data.IExtent}
 * @implements {os.ui.ILayerUIProvider}
 * @constructor
 */
os.data.LayerNode = function() {
  os.data.LayerNode.base(this, 'constructor');

  /**
   * @type {os.layer.ILayer}
   * @private
   */
  this.layer_ = null;

  os.ui.queryManager.listen(goog.events.EventType.PROPERTYCHANGE, this.onNodeChanged_, false, this);
};
goog.inherits(os.data.LayerNode, os.ui.slick.SlickTreeNode);
os.implements(os.data.LayerNode, os.ui.ILayerUIProvider.ID);


/**
 * @inheritDoc
 */
os.data.LayerNode.prototype.disposeInternal = function() {
  os.data.LayerNode.base(this, 'disposeInternal');

  os.ui.queryManager.unlisten(goog.events.EventType.PROPERTYCHANGE, this.onNodeChanged_, false, this);

  this.onMouseLeave();
  this.setLayer(null);
};


/**
 * @inheritDoc
 */
os.data.LayerNode.prototype.getExtent = function() {
  var extent = null;
  var layer = this.getLayer();

  if (layer instanceof os.layer.Vector) {
    extent = /** @type {os.layer.Vector} */ (layer).getSource().getExtent();
  }

  return extent;
};


/**
 * @inheritDoc
 */
os.data.LayerNode.prototype.setState = function(value) {
  var children = this.getChildren();
  if (value !== os.structs.TriState.BOTH || (children && children.length)) {
    var old = this.getState();
    os.data.LayerNode.base(this, 'setState', value);
    var s = this.getState();

    if (old != s && value !== os.structs.TriState.BOTH && this.layer_) {
      this.layer_.setEnabled(s !== os.structs.TriState.OFF);
    }
  }
};


/**
 * @return {os.layer.ILayer} The layer
 */
os.data.LayerNode.prototype.getLayer = function() {
  return this.layer_;
};


/**
 * @inheritDoc
 */
os.data.LayerNode.prototype.formatCheckbox = function() {
  const checkboxParts = [];

  const layer = this.getLayer();
  if (layer) {
    // add a normal checkbox (layer enable/disable) if the layer is not removable
    if (layer.isRemovable()) {
      checkboxParts.push('<tristatecheckbox></tristatecheckbox>');
    }

    // add a separate visibility toggle for feature layers
    if (layer instanceof os.layer.Vector) {
      const padClass = checkboxParts.length ? 'pl-1' : '';
      checkboxParts.push(`<layervisibility class="c-glyph ${padClass}"></layervisibility>`);
    }
  }

  return checkboxParts.join('');
};


/**
 * Sets the layer
 *
 * @param {os.layer.ILayer} value
 */
os.data.LayerNode.prototype.setLayer = function(value) {
  if (value !== this.layer_) {
    if (this.layer_) {
      ol.events.unlisten(/** @type {ol.events.EventTarget} */ (this.layer_), goog.events.EventType.PROPERTYCHANGE,
          this.onPropertyChange, this);
    }

    var old = this.layer_;
    this.layer_ = value;

    if (value) {
      ol.events.listen(/** @type {ol.events.EventTarget} */ (value), goog.events.EventType.PROPERTYCHANGE,
          this.onPropertyChange, this);
      this.setId(value.getId());
      this.setLabel(value.getTitle());

      var result = undefined;
      if (value instanceof os.layer.LayerGroup) {
        var layers = /** @type {os.layer.LayerGroup} */ (value).getLayers();
        for (var i = 0, n = layers.length; i < n; i++) {
          if (result === undefined) {
            result = layers[i].isEnabled();
          } else if (result != layers[i].isEnabled()) {
            this.setState(os.structs.TriState.BOTH);
            result = undefined;
            break;
          }
        }
      } else {
        result = value.isEnabled();
      }

      if (result !== undefined) {
        this.setState(result ? os.structs.TriState.ON : os.structs.TriState.OFF);
      }

      this.nodeUI = value.getNodeUI();
    }

    this.dispatchEvent(new os.events.PropertyChangeEvent('layer', value, old));
  }
};


/**
 * @inheritDoc
 */
os.data.LayerNode.prototype.getId = function() {
  if (this.layer_) {
    return this.layer_.getId();
  }

  return os.data.LayerNode.base(this, 'getId');
};


/**
 * @inheritDoc
 */
os.data.LayerNode.prototype.getLabel = function() {
  if (this.layer_) {
    return this.layer_.getTitle();
  }

  return this.getId();
};


/**
 * @inheritDoc
 */
os.data.LayerNode.prototype.getSearchText = function() {
  var t = '';

  if (this.layer_) {
    t += this.layer_.getTitle();
    t += this.getTags() ? ' ' + this.getTags().join(' ') : '';
    t += ' ' + this.layer_.getOSType();

    // see if there is a descriptor for this guy and add its search text as well
    var dm = os.dataManager;
    var d = dm.getDescriptor(this.layer_.getId());

    if (d) {
      t += ' ' + d.getSearchText();
    }
  }

  return t;
};


/**
 * @inheritDoc
 */
os.data.LayerNode.prototype.getTags = function() {
  return this.layer_ ? this.layer_.getTags() : null;
};


/**
 * @inheritDoc
 */
os.data.LayerNode.prototype.formatIcons = function() {
  var s = null;

  if (this.layer_) {
    s = this.layer_.getIcons();
  }

  if (!s) {
    return os.data.LayerNode.base(this, 'formatIcons');
  }

  return s;
};


/**
 * Whether or not the layer is loading
 *
 * @return {boolean}
 * @export
 */
os.data.LayerNode.prototype.isLoading = function() {
  if (this.layer_) {
    return this.layer_.isLoading();
  }

  return false;
};


/**
 * Handles changes on the layer
 *
 * @param {os.events.PropertyChangeEvent} e The event
 * @protected
 */
os.data.LayerNode.prototype.onPropertyChange = function(e) {
  if (e instanceof os.events.PropertyChangeEvent) {
    var p = e.getProperty();
    switch (p) {
      case os.layer.PropertyChange.LOADING:
        this.dispatchEvent(new os.events.PropertyChangeEvent('loading', e.getOldValue(), e.getNewValue()));
        break;
      case os.layer.PropertyChange.ENABLED:
        // force the checkbox to update
        this.setState(e.getNewValue() ? os.structs.TriState.ON : os.structs.TriState.OFF);
        // update the label (styled differently when disabled/hidden)
        this.dispatchEvent(new os.events.PropertyChangeEvent('label'));
        break;
      case os.layer.PropertyChange.VISIBLE:
        // update the label (styled differently when disabled/hidden)
        this.dispatchEvent(new os.events.PropertyChangeEvent('label'));
        break;
      case os.layer.PropertyChange.TITLE:
        // change the label
        this.setLabel(this.layer_.getTitle());
        this.dispatchEvent(new os.events.PropertyChangeEvent('label'));
        break;
      case os.layer.PropertyChange.GROUP_ID:
        os.map.mapContainer.dispatchEvent(os.events.LayerEventType.CHANGE);
        break;
      case os.layer.PropertyChange.COLOR_MODEL:
      case os.layer.PropertyChange.ERROR:
      case os.layer.PropertyChange.ICONS:
      case os.layer.PropertyChange.LOCK:
      case os.layer.PropertyChange.STYLE:
      case os.layer.PropertyChange.TIME_ENABLED:
        // updates icons on the node
        this.dispatchEvent(new os.events.PropertyChangeEvent('icons'));
        break;
      default:
        break;
    }
  }
};


/**
 * @inheritDoc
 */
os.data.LayerNode.prototype.updateFrom = function(other) {
  this.setLayer(other.getLayer());
  os.data.LayerNode.base(this, 'updateFrom', other);
};


/**
 * @inheritDoc
 */
os.data.LayerNode.prototype.formatLabel = function(value) {
  var labelClass = 'text-truncate flex-fill';
  if (this.layer_ && (!this.layer_.isEnabled() || !this.layer_.getLayerVisible())) {
    // if the layer is disabled/hidden, adjust the style to indicate the change
    labelClass += ' text-muted';
  }

  return `<span class="${labelClass}">${this.formatValue(value)}</span>`;
};


/**
 * @inheritDoc
 */
os.data.LayerNode.prototype.formatValue = function(value) {
  var s = os.data.LayerNode.base(this, 'formatValue', value);
  var layer = this.getLayer();

  if (layer instanceof os.layer.LayerGroup) {
    s += ' (' + this.getLayer().getProvider() + ')';
  } else {
    s += ' <layertype></layertype>';

    if (layer instanceof os.layer.Vector) {
      s += ' <featurecount></featurecount>';
    } else if (layer instanceof os.layer.Tile) {
      s += ' <tileloading></tileloading>';
    }
  }

  return s;
};


/**
 * @inheritDoc
 */
os.data.LayerNode.prototype.getLayerUI = function(item) {
  if (item && item instanceof os.data.LayerNode) {
    var node = /** @type {os.data.LayerNode} */ (item);
    var l = node.getLayer();

    return l.getLayerUI() || 'defaultlayerui';
  }

  return null;
};


/**
 * @param {os.events.PropertyChangeEvent} event
 * @private
 */
os.data.LayerNode.prototype.onNodeChanged_ = function(event) {
  this.dispatchEvent(new os.events.PropertyChangeEvent('icons'));
};
