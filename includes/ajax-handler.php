<?php
/**
 * includes/ajax-handler.php
 */
if (!defined('ABSPATH')) exit;

add_action('wp_ajax_agaf_author_counts', 'agaf_author_counts');
add_action('wp_ajax_nopriv_agaf_author_counts', 'agaf_author_counts');

function agaf_author_counts(){
   $author_id = isset($_POST['author_id']) ? (int) $_POST['author_id'] : 0;
   if (!$author_id) wp_send_json_success(['counts' => []]);

   $cat_id = isset($_POST['cat_id']) ? (int) $_POST['cat_id'] : 0;

   // targets/taxes (რომელთათვისაც გვინდა ქოუნთების დაბრუნება)
   $targets = [];
   if (!empty($_POST['targets']) && is_array($_POST['targets'])) {
      foreach ($_POST['targets'] as $tx) {
         $tx = sanitize_text_field($tx);
         if (taxonomy_exists($tx)) $targets[] = $tx;
      }
   }
   // fallback – თუ targets არ იყო გადმოცემული, ვიპოვოთ ყველგან
   if (empty($targets) && !empty($_POST['taxes']) && is_array($_POST['taxes'])) {
      foreach ($_POST['taxes'] as $tx) {
         $tx = sanitize_text_field($tx);
         if (taxonomy_exists($tx)) $targets[] = $tx;
      }
   }
   $targets = array_values(array_unique($targets));

   // აქტიური ფილტრების ამოღება — ვიღებთ როგორც array-ს, ისე JSON-ს
   $active_filters = [];
   if (isset($_POST['filters'])) {
      $raw = $_POST['filters'];

      if (is_string($raw)) {
         $decoded = json_decode(stripslashes($raw), true);
         if (is_array($decoded)) $raw = $decoded;
      }

      $price_min = null;
      $price_max = null;

      if (isset($_POST['filters'])) {
         $raw_price = $_POST['filters'];
         if (is_string($raw_price)) {
            $raw_price = json_decode(stripslashes($raw_price), true);
         }
         if (is_array($raw_price) && isset($raw_price['price_range']) && is_array($raw_price['price_range'])) {
            if (isset($raw_price['price_range']['min']) && $raw_price['price_range']['min'] !== '') {
               $price_min = (int)$raw_price['price_range']['min'];
            }
            if (isset($raw_price['price_range']['max']) && $raw_price['price_range']['max'] !== '') {
               $price_max = (int)$raw_price['price_range']['max'];
            }
         }
      }
   }

   // === PRICE meta_query ბაზა ===
   $base_meta_query = [];
   if ($price_min !== null || $price_max !== null) {
      // WooCommerce-სთვის ვიყენებთ `_price`-ს როგორც მთავარ გასაღებს
      if ($price_min !== null && $price_max !== null) {
         $base_meta_query[] = [
            'key'     => '_price',
            'value'   => [ $price_min, $price_max ],
            'compare' => 'BETWEEN',
            'type'    => 'NUMERIC',
         ];
      } elseif ($price_min !== null) {
         $base_meta_query[] = [
            'key'     => '_price',
            'value'   => $price_min,
            'compare' => '>=',
            'type'    => 'NUMERIC',
         ];
      } elseif ($price_max !== null) {
         $base_meta_query[] = [
            'key'     => '_price',
            'value'   => $price_max,
            'compare' => '<=',
            'type'    => 'NUMERIC',
         ];
      }
   }


   // საერთო კონტექსტი (ავტორი + კატეგორია + სხვა ფილტრები)
   $base_tax_query = ['relation' => 'AND'];

   if ($cat_id > 0) {
      $base_tax_query[] = [
         'taxonomy'         => 'product_cat',
         'field'            => 'term_id',
         'terms'            => [$cat_id],
         'include_children' => true,
      ];
   }
   foreach ($active_filters as $tax => $slugs) {
      $base_tax_query[] = [
         'taxonomy'         => $tax,
         'field'            => 'slug',
         'terms'            => $slugs,
         'operator'         => 'IN',
         'include_children' => true,
      ];
   }
   if (count($base_tax_query) === 1) $base_tax_query = []; // მხოლოდ relation იყო

   $result = [];

   // თითო სამიზნე ტაქსონზე ვამზადებთ ქოუნთებს
   foreach ($targets as $tx) {
      $terms = get_terms(['taxonomy' => $tx, 'hide_empty' => false]);
      if (is_wp_error($terms) || empty($terms)) { $result[$tx] = []; continue; }

      $result[$tx] = [];

      foreach ($terms as $term) {
         // self-exclusion: ამ ტაქსონის არსებული ფილტრები *არ მოხვდეს* ამ ტერმის დათვლაში
         $tx_query = ['relation' => 'AND'];
         // ჩასვით base პირობები, მაგრამ active_filters-დან ამ ტაქსონის ნაწილის გარეშე
         if (!empty($base_tax_query)) {
            foreach ($base_tax_query as $piece) {
               if (!is_array($piece) || empty($piece['taxonomy'])) continue;
               if ($piece['taxonomy'] === $tx) continue; // self remove
               $tx_query[] = $piece;
            }
         }

         // საბოლოოდ ამ ტერმსაც ვამატებთ
         $tx_query[] = [
            'taxonomy'         => $tx,
            'field'            => 'term_id',
            'terms'            => [(int)$term->term_id],
            'include_children' => true,
         ];

         $args = [
            'post_type'      => 'product',
            'post_status'    => 'publish',
            'author'         => $author_id,
            'tax_query'      => $tx_query,
            'fields'         => 'ids',
            'posts_per_page' => 1,
            'no_found_rows'  => false, // საჭიროა found_posts
         ];
         if (!empty($base_meta_query)) {
            $args['meta_query'] = $base_meta_query;
         }

         $q = new WP_Query($args);
         $result[$tx][ (int)$term->term_id ] = (int)$q->found_posts;
         wp_reset_postdata();
      }
   }

   wp_send_json_success(['counts' => $result]);
}