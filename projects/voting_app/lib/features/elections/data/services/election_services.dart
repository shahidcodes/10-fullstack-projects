import 'package:dio/dio.dart';

import '../../../../core/config/api_config.dart';
import '../../../../core/network/dio_client.dart';
import '../models/election_model.dart';

class ElectionService {
  final Dio _dio;

  ElectionService(DioClient dioClient) : _dio = dioClient.dio;

  /// Fetch all elections.
  Future<List<ElectionModel>> getElections() async {
    final response = await _dio.get(ApiConfig.elections);

    final responseData = response.data as Map<String, dynamic>;
    final data = responseData['data'];

    // Supports either:
    // { "data": [...] }
    // { "data": { "elections": [...] } }
    if (data is List) {
      return data
          .map((item) => ElectionModel.fromJson(item as Map<String, dynamic>))
          .toList();
    }

    if (data is Map<String, dynamic>) {
      final elections = data['elections'] ?? data['items'];

      if (elections is List) {
        return elections
            .map((item) => ElectionModel.fromJson(item as Map<String, dynamic>))
            .toList();
      }
    }

    throw const FormatException('Invalid elections response format.');
  }

  /// Fetch a single election by its ID.
  Future<ElectionModel> getElectionById(String electionId) async {
    final response = await _dio.get(ApiConfig.electionDetails(electionId));

    final responseData = response.data as Map<String, dynamic>;
    final data = responseData['data'];

    if (data is Map<String, dynamic>) {
      final election = data['election'] ?? data;

      if (election is Map<String, dynamic>) {
        return ElectionModel.fromJson(election);
      }
    }

    throw const FormatException('Invalid election details response format.');
  }
}
