#include <iostream>
#include <thread>
#include <mutex>
#include <vector>
#include <string>

#include <httplib.h>                    // vcpkg: cpp-httplib

#include <libtorrent/session.hpp>
#include <libtorrent/settings_pack.hpp>
#include <libtorrent/add_torrent_params.hpp>
#include <libtorrent/torrent_handle.hpp>
#include <libtorrent/torrent_status.hpp>
#include <libtorrent/torrent_info.hpp>
#include <libtorrent/alert_types.hpp>
#include <libtorrent/read_resume_data.hpp>
#include <libtorrent/write_resume_data.hpp>
#include <libtorrent/magnet_uri.hpp>    // parse_magnet_uri
#include <libtorrent/sha1_hash.hpp>

using namespace std::chrono_literals;
namespace lt = libtorrent;

static std::unique_ptr<lt::session> g_sess;
static std::mutex g_mtx;

struct Args {
  int         port    = 5040;
  std::string profile = ".sumo";
};

static Args parse_args(int argc, char** argv) {
  Args a;
  for (int i = 1; i < argc; i++) {
    std::string s = argv[i];
    if (s == "--port" && i + 1 < argc) a.port = std::stoi(argv[++i]);
    else if (s == "--profile" && i + 1 < argc) a.profile = argv[++i];
  }
  return a;
}

static void init_session(const Args& /*cfg*/) {
  lt::settings_pack sp;
  sp.set_str(lt::settings_pack::user_agent, "sumo/0.1");
  sp.set_bool(lt::settings_pack::enable_dht, true);
  sp.set_bool(lt::settings_pack::enable_upnp, true);
  sp.set_bool(lt::settings_pack::enable_natpmp, true);
  sp.set_int(lt::settings_pack::alert_mask,
             lt::alert_category::status | lt::alert_category::error);

  g_sess = std::make_unique<lt::session>(sp);
  // TODO: load/save resume data in cfg.profile
}

static std::string json_escape(const std::string& s) {
  std::string o; o.reserve(s.size() + 8);
  for (char c : s) {
    if (c == '"' || c == '\\') o.push_back('\\');
    o.push_back(c);
  }
  return o;
}

// ----- hex helper for SHA-1 (v1) -----
static std::string to_hex(const lt::sha1_hash& h) {
  static const char* hexd = "0123456789abcdef";
  std::string out; out.resize(40);
  auto b = h.data();
  for (int i = 0; i < 20; ++i) {
    out[i*2]   = hexd[(b[i] >> 4) & 0xF];
    out[i*2+1] = hexd[b[i] & 0xF];
  }
  return out;
}

static std::string torrent_status_json(const lt::torrent_status& st) {
  std::string s = "{";
  s += "\"hash\":\"" + to_hex(st.info_hashes.v1) + "\",";
  s += "\"name\":\"" + json_escape(st.name) + "\"";
  s += ",\"progress\":"     + std::to_string(st.progress);
  s += ",\"downloadRate\":" + std::to_string(st.download_rate);
  s += ",\"uploadRate\":"   + std::to_string(st.upload_rate);
  s += ",\"state\":"        + std::to_string(int(st.state));
  s += "}";
  return s;
}

int main(int argc, char** argv) {
  auto cfg = parse_args(argc, argv);
  init_session(cfg);

  httplib::Server svr;

  // POST /api/add  magnet=...&savepath=...&sequential=0|1
  svr.Post("/api/add", [](const httplib::Request& req, httplib::Response& res) {
    auto magnet = req.get_param_value("magnet");
    auto save   = req.get_param_value("savepath");
    bool seq    = req.get_param_value("sequential") == "1";

    lt::add_torrent_params p;
    p.save_path = save.empty() ? "." : save;
    p.flags    |= lt::torrent_flags::paused;

    lt::error_code ec;
    lt::parse_magnet_uri(magnet, p, ec);
    if (ec) {
      res.status = 400;
      res.set_content("{\"error\":\"bad magnet\"}", "application/json");
      return;
    }

    lt::torrent_handle h;
    {
      std::lock_guard<std::mutex> lk(g_mtx);
      h = g_sess->add_torrent(p);
    }

    // sequential mode via flags (no set_sequential_download in v2)
    auto f = h.flags();
    if (seq) f |= lt::torrent_flags::sequential_download;
    else     f &= ~lt::torrent_flags::sequential_download;
    h.set_flags(f);

    h.resume();

    res.set_content(
      std::string("{\"ok\":true,\"hash\":\"") +
      to_hex(h.info_hashes().v1) + "\"}",
      "application/json"
    );
  });

  // POST /api/pause  hashes=<hash>
  svr.Post("/api/pause", [](const httplib::Request& req, httplib::Response& res) {
    auto hash = req.get_param_value("hashes");
    std::vector<lt::torrent_handle> v;
    {
      std::lock_guard<std::mutex> lk(g_mtx);
      v = g_sess->get_torrents();
    }
    for (auto& h : v) {
      if (to_hex(h.info_hashes().v1) == hash) h.pause();
    }
    res.set_content("{\"ok\":true}", "application/json");
  });

  // POST /api/resume  hashes=<hash>
  svr.Post("/api/resume", [](const httplib::Request& req, httplib::Response& res) {
    auto hash = req.get_param_value("hashes");
    std::vector<lt::torrent_handle> v;
    {
      std::lock_guard<std::mutex> lk(g_mtx);
      v = g_sess->get_torrents();
    }
    for (auto& h : v) {
      if (to_hex(h.info_hashes().v1) == hash) h.resume();
    }
    res.set_content("{\"ok\":true}", "application/json");
  });

  // POST /api/sequential  hashes=<hash>&on=0|1
  svr.Post("/api/sequential", [](const httplib::Request& req, httplib::Response& res) {
    auto hash = req.get_param_value("hashes");
    bool on   = req.get_param_value("on") == "1";
    std::vector<lt::torrent_handle> v;
    {
      std::lock_guard<std::mutex> lk(g_mtx);
      v = g_sess->get_torrents();
    }
    for (auto& h : v) if (to_hex(h.info_hashes().v1) == hash) {
      auto f = h.flags();
      if (on) f |= lt::torrent_flags::sequential_download;
      else    f &= ~lt::torrent_flags::sequential_download;
      h.set_flags(f);
    }
    res.set_content("{\"ok\":true}", "application/json");
  });

  // (Optional) keep /api/firstlast as a no-op for now
  svr.Post("/api/firstlast", [](const httplib::Request&, httplib::Response& res){
    res.set_content("{\"ok\":true}", "application/json");
  });

  // GET /api/torrents
  svr.Get("/api/torrents", [](const httplib::Request&, httplib::Response& res) {
    std::vector<lt::torrent_handle> v;
    {
      std::lock_guard<std::mutex> lk(g_mtx);
      v = g_sess->get_torrents();
    }
    std::vector<lt::torrent_status> st;
    st.reserve(v.size());
    for (auto& h : v) st.push_back(h.status());

    std::string json = "[";
    bool first = true;
    for (auto& s : st) {
      if (!first) json += ',';
      json += torrent_status_json(s);
      first = false;
    }
    json += "]";
    res.set_content(json, "application/json");
  });

  // GET /api/files?hash=<hash>
  svr.Get("/api/files", [](const httplib::Request& req, httplib::Response& res) {
    auto hash = req.get_param_value("hash");
    std::vector<lt::torrent_handle> v;
    {
      std::lock_guard<std::mutex> lk(g_mtx);
      v = g_sess->get_torrents();
    }
    for (auto& h : v) if (to_hex(h.info_hashes().v1) == hash) {
      auto ti = h.torrent_file();
      if (!ti) break;

      std::string json = "[";
      bool first = true;

      const int n = ti->num_files();
      for (int i = 0; i < n; ++i) {
        lt::file_index_t fi{i};
        auto fp = ti->files().file_path(fi);
        if (!first) json += ',';
        first = false;
        json += "{\"id\":" + std::to_string(i) + ",\"path\":\"" + json_escape(fp) + "\"}";
      }
      json += "]";
      res.set_content(json, "application/json");
      return;
    }
    res.status = 404;
    res.set_content("{\"error\":\"not found\"}", "application/json");
  });

  std::cout << "sumo-daemon listening on http://127.0.0.1:" << cfg.port << "\n";
  svr.listen("127.0.0.1", cfg.port);
}
