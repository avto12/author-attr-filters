<?php
/**
 * Plugin Name: Author Attribute Filters (UI only)
 * Description: ავტორის გვერდისათვის მხოლოდ ფილტრების UI. აგროვებს window.AGAF_FILTERS-ს და ითხოვს პროდუქტებს agAuthorFetchProducts() საშუალებით.
 * Version: 1.0.0
 * Author: Avtandil Kakachishvili
 * Text Domain: authorAttrFilters
 */

if (!defined('ABSPATH')) exit;

define('AGAFUI_VER', '1.0.0');
define('AGAFUI_NS',  'authorAttrFilters');
define('AGAFUI_DIR', plugin_dir_path(__FILE__));
define('AGAFUI_URL', plugin_dir_url(__FILE__));

require_once AGAFUI_DIR . 'includes/ajax-handler.php';

final class AGAF_Filters_UI_Only {
   private static $enqueued = false;

   public function __construct() {
      add_shortcode('agaf_filters', [$this, 'sc_filters']);
   }

   private function enqueue_assets_once() {
      if (self::$enqueued) return;
      self::$enqueued = true;

      wp_enqueue_style(
         'ag-author-filter-styles',
         AGAFUI_URL . 'assets/author-filters.css',
         [],
         AGAFUI_VER
      );

      wp_enqueue_script(
         'ag-author-filters-script',
         AGAFUI_URL . 'assets/author-filters.js',
         [],
         AGAFUI_VER,
         true
      );

      // Localize script for translations
      wp_localize_script('ag-author-filters-script', 'AGAF_I18N', [
         'search_placeholder' => __('ძიება...', AGAFUI_NS),
         'all_selected'       => __('ყველა ქალაქი', AGAFUI_NS),
         'selected'           => __('არჩეულია', AGAFUI_NS),
         'none_selected'      => __('არჩეული არ არის', AGAFUI_NS),
      ]);
   }

   /**
    * [agaf_filters taxes="pa_city:select,pa_mitanis-pirobebi:checkbox" class="..." placeholder="აირჩიე" show_cont="yes|no"]
    */


   public function sc_filters($atts) {
      $a = shortcode_atts([
         'taxes'       => '',
         'title'       => '',
         'class'       => '',
         'placeholder' => __('აირჩიე', AGAFUI_NS),
         'show_cont'   => 'no',
      ], $atts, 'agaf_filters');

      if (!$a['taxes']) return '';
      $items = array_filter(array_map('trim', explode(',', $a['taxes'])));
      if (!$items) return '';

      $this->enqueue_assets_once();

      $uid         = 'agaf-' . wp_generate_uuid4();
      $show_count  = ($a['show_cont'] === 'yes');

      $author = get_queried_object();
      $author_id = ($author && isset($author->ID)) ? (int) $author->ID : 0;

      $max_price = (int) $this->get_max_price($author_id);
      $min_price = (int) $this->get_min_price($author_id);

      if ($max_price < 1) {
         $max_price = 1000;
      }
      if ($min_price < 0 || $min_price > $max_price) {
         $min_price = 0;
      }
      ob_start(); ?>
       <div class="agaf-filters <?php echo esc_attr($a['class']); ?>"
            data-agaf-id="<?php echo esc_attr($uid); ?>"
            data-show-count="<?php echo $show_count ? 'yes' : 'no'; ?>">


          <?php foreach ($items as $raw):
             $parts    = array_map('trim', explode(':', $raw));
             $tax      = $parts[0] ?? '';
             $type     = $parts[1] ?? 'select';
             $multiple = $parts[2] ?? 'no';

             if (!$tax) continue;

             // ფასის ფილტრის შემთხვევა - ახალი დამატება
             if ($tax === 'price_range' && $type === 'price'): ?>
                 <div class="agaf-filter agaf--price" data-tax="price_range">
                     <div class="agaf-filter__head">
                         <div class="agaf-filter__label">
                            <?php echo esc_html(!empty($a['title']) ? $a['title'] : __('ფასი', AGAFUI_NS)); ?>
                         </div>
                     </div>

                     <div class="agaf-price-filter"
                          data-max-price="<?php echo esc_attr($max_price); ?>">
                         <div class="agaf-price-inputs">
                             <div class="agaf-price-input">
                                 <input type="number"
                                        id="<?php echo $uid; ?>-min-price"
                                        class="agaf-price-min"
                                        placeholder="<?php echo esc_attr($min_price); ?>"
                                        min="<?php echo esc_attr($min_price); ?>"
                                        max="<?php echo esc_attr($max_price); ?>">
                                 <span class="agaf-price-currency">₾</span>
                             </div>
                             <div class="agaf-price-input">
                                 <input type="number"
                                        id="<?php echo $uid; ?>-max-price"
                                        class="agaf-price-max"
                                        placeholder="<?php echo esc_attr($max_price); ?>"
                                        min="<?php echo esc_attr($min_price); ?>"
                                        max="<?php echo esc_attr($max_price); ?>">
                                 <span class="agaf-price-currency">₾</span>
                             </div>
                         </div>

                         <div class="agaf-price-slider">
                             <div class="agaf-slider-track"></div>
                             <input type="range" class="agaf-slider-min"
                                    min="<?php echo esc_attr($min_price); ?>"
                                    max="<?php echo esc_attr($max_price); ?>"
                                    value="<?php echo esc_attr($min_price); ?>" step="1">
                             <input type="range" class="agaf-slider-max"
                                    min="<?php echo esc_attr($min_price); ?>"
                                    max="<?php echo esc_attr($max_price); ?>"
                                    value="<?php echo esc_attr($max_price); ?>" step="1">
                         </div>

                         <button type="button" class="agaf-price-apply">
                            <?php _e('გაფილტვრა', AGAFUI_NS); ?>
                     </div>
                 </div>

             <?php
             // არსებული ტაქსონომიების ფილტრები - თქვენი ორიგინალური კოდი უცვლელი
             elseif (taxonomy_exists($tax)):
                $terms = get_terms(['taxonomy'=>$tax, 'hide_empty'=>false]);
                if (is_wp_error($terms) || empty($terms)) continue;

                $wrapper_cls = 'agaf-filter agaf--' . esc_attr($type);
                $is_multi = ($multiple === 'yes'); ?>

                 <div class="<?php echo $wrapper_cls; ?>" data-tax="<?php echo esc_attr($tax); ?>">
                     <div class="agaf-filter__head">
                         <div class="agaf-filter__label">
                            <?php
                            if (!empty($a['title'])) {
                               echo esc_html($a['title']);
                            } else {
                               $tx = get_taxonomy($tax);
                               echo esc_html($tx && isset($tx->labels->singular_name) ? $tx->labels->singular_name : $tax);
                            }
                            ?>
                         </div>
                     </div>

                    <?php if ($type === 'checkbox'): ?>
                        <div class="agaf-checks">
                           <?php foreach ($terms as $t): ?>
                               <label class="agaf-check"
                                      data-tax="<?php echo esc_attr($tax); ?>"
                                      data-term-id="<?php echo (int) $t->term_id; ?>">
                                   <input type="checkbox"
                                          class="agaf-input"
                                          data-tax="<?php echo esc_attr($tax); ?>"
                                          data-term-id="<?php echo (int) $t->term_id; ?>"
                                          value="<?php echo esc_attr($t->slug); ?>">
                                   <span class="agaf-term-text"><?php echo esc_html($t->name); ?></span>
                                   <span class="agaf-count" aria-hidden="true"></span>
                               </label>
                           <?php endforeach; ?>
                        </div>

                    <?php else: // Select type ?>
                        <div class="agaf-select">
                            <button type="button" class="agaf-select-toggle" aria-expanded="false">
                                <span class="agaf-selected-text"><?php echo esc_html($a['placeholder']); ?></span>
                                <span class="agaf-caret" aria-hidden="true">
                                    <i class="fas fa-chevron-down"></i>
                                </span>
                            </button>

                            <div class="agaf-select-dropdown">
                                <div class="agaf-select-search">
                                    <input type="text" class="agaf-select-search-input"
                                           placeholder="<?php esc_attr_e('მოძებნა...', AGAFUI_NS); ?>" />
                                    <span class="agaf-select-search-icon">
                                        <i class="fas fa-search"></i>
                                    </span>
                                </div>

                                <ul class="agaf-select-list" role="listbox" aria-multiselectable="<?php echo $is_multi ? 'true' : 'false'; ?>">
                                    <li class="agaf-select-item agaf-select-item-all">
                                        <label>
                                            <input type="checkbox" class="agaf-select-check-all" checked />
                                            <span>
                                                <?php echo esc_html($a['placeholder']); ?>
                                               <?php if ($show_count): ?>
                                                   <small class="agaf-count">(<?php echo count($terms); ?>)</small>
                                               <?php endif; ?>
                                            </span>
                                        </label>
                                    </li>
                                   <?php foreach ($terms as $t):
                                      // მძიმემდე ნაწილის ამოღება
                                      $name = $t->name;
                                      $comma_pos = mb_strpos($name, ',', 0, 'UTF-8');
                                      $display_name = ($comma_pos !== false) ? trim(mb_substr($name, 0, $comma_pos, 'UTF-8')) : $name;
                                      ?>
                                       <li class="agaf-select-item" data-name="<?php echo esc_attr(mb_strtolower($t->name)); ?>">
                                           <label>
                                               <input type="checkbox" class="agaf-select-check"
                                                      value="<?php echo esc_attr($t->slug); ?>"
                                                      data-tax="<?php echo esc_attr($tax); ?>"
                                                      data-term-id="<?php echo (int) $t->term_id; ?>"
                                                      checked />
                                               <span class="agaf-select-name">
                                                    <?php echo esc_html($display_name); ?>
                                                  <?php if ($show_count): ?>
                                                      <small class="agaf-count">(<?php echo (int) $t->count; ?>)</small>
                                                  <?php endif; ?>
                                                </span>
                                           </label>
                                       </li>
                                   <?php endforeach; ?>
                                </ul>
                            </div>
                        </div>
                    <?php endif; ?>
                 </div>
             <?php endif; ?>
          <?php endforeach; ?>
       </div>
      <?php
      return ob_get_clean();
   }
   // მაქსიმალური ფასის გამოთვლის ფუნქცია
   private function get_max_price($author_id = null) {
      if (!$author_id) {
         // მიმდინარე ავტორის ID-ის აღება
         $author = get_queried_object();
         $author_id = ($author && isset($author->ID)) ? (int) $author->ID : 0;
      }

      if (!$author_id) return 0;

      $cache_key = 'agaf_price_max_' . $author_id;
      $cached = get_transient($cache_key);
      if ($cached !== false) return (float) $cached;

      global $wpdb;
      $max = $wpdb->get_var($wpdb->prepare("
        SELECT MAX(CAST(pm.meta_value AS DECIMAL(20,4)))
        FROM {$wpdb->postmeta} pm
        JOIN {$wpdb->posts} p ON p.ID = pm.post_id
        WHERE pm.meta_key = '_price'
          AND pm.meta_value <> ''
          AND p.post_status = 'publish'
          AND p.post_type IN ('product','product_variation')
          AND p.post_author = %d
    ", $author_id));

      $max = $max !== null ? (float) $max : 0.0;
      set_transient($cache_key, $max, 10 * MINUTE_IN_SECONDS);
      return $max;
   }

// 🔥 მინიმალური ფასის გამოთვლის ფუნქცია (მხოლოდ ამ ავტორისთვის)
   private function get_min_price($author_id = null) {
      if (!$author_id) {
         // მიმდინარე ავტორის ID-ის აღება
         $author = get_queried_object();
         $author_id = ($author && isset($author->ID)) ? (int) $author->ID : 0;
      }

      if (!$author_id) return 0;

      $cache_key = 'agaf_price_min_' . $author_id;
      $cached = get_transient($cache_key);
      if ($cached !== false) return (float) $cached;

      global $wpdb;
      $min = $wpdb->get_var($wpdb->prepare("
        SELECT MIN(CAST(pm.meta_value AS DECIMAL(20,4)))
        FROM {$wpdb->postmeta} pm
        JOIN {$wpdb->posts} p ON p.ID = pm.post_id
        WHERE pm.meta_key = '_price'
          AND pm.meta_value <> ''
          AND CAST(pm.meta_value AS DECIMAL(20,4)) > 0
          AND p.post_status = 'publish'
          AND p.post_type IN ('product','product_variation')
          AND p.post_author = %d
    ", $author_id));

      $min = $min !== null ? (float) $min : 0.0;
      set_transient($cache_key, $min, 10 * MINUTE_IN_SECONDS);
      return $min;
   }
}
new AGAF_Filters_UI_Only();